import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileSelectPage } from "./ProfileSelectPage";

const authMock = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => authMock.value
}));

const firstProfile = {
  userIdx: 25,
  username: "첫째",
  status: 0,
  isActive: true,
  isCurrent: false,
  spoint: 0,
  lpoint: 0,
  llevel: 1
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProfileSelectPage", () => {
  it("asks before retrying an idle profile with force=1", async () => {
    const selectProfile = vi.fn()
      .mockResolvedValueOnce({ resultCode: 353, resultMessage: "확인이 필요합니다.", holderIdleSec: 125 })
      .mockResolvedValueOnce({
        resultCode: 1,
        resultMessage: "success",
        account: { accountIdx: 7, userId: "family01", username: "보호자", email: "" },
        profile: { ...firstProfile, isCurrent: true },
        profiles: [{ ...firstProfile, isCurrent: true }]
      });
    authMock.value = createAuthState({ selectProfile });

    renderProfileSelect();

    fireEvent.click(screen.getByRole("button", { name: "첫째 학습 프로필 선택" }));
    expect(await screen.findByRole("heading", { name: "이 프로필을 계속 사용하시겠습니까?" })).toBeInTheDocument();
    expect(screen.getByText("마지막 사용: 2분 5초 전", { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "계속 사용" }));

    await waitFor(() => expect(selectProfile).toHaveBeenCalledTimes(2));
    expect(selectProfile).toHaveBeenNthCalledWith(1, 25, false);
    expect(selectProfile).toHaveBeenNthCalledWith(2, 25, true);
  });

  it("does not force a profile that is actively learning", async () => {
    const selectProfile = vi.fn().mockResolvedValue({ resultCode: 351, resultMessage: "학습 진행 중입니다." });
    authMock.value = createAuthState({ selectProfile });

    renderProfileSelect();

    fireEvent.click(screen.getByRole("button", { name: "첫째 학습 프로필 선택" }));

    expect(await screen.findByText("이 프로필은 현재 학습 진행 중입니다. 다른 프로필을 선택해 주세요.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "이 프로필을 계속 사용하시겠습니까?" })).not.toBeInTheDocument();
    expect(selectProfile).toHaveBeenCalledWith(25, false);
  });

  it("hides self-service profile creation for a BTB account", () => {
    authMock.value = createAuthState({ selectProfile: vi.fn() });
    authMock.value = {
      ...authMock.value,
      account: { accountIdx: 7, userId: "academy01", username: "학원", email: "", canManageProfiles: false }
    };

    renderProfileSelect();

    expect(screen.queryByRole("button", { name: "프로필 추가" })).not.toBeInTheDocument();
    expect(screen.getByText("학원 소속 계정의 프로필 추가와 편집은 학원 관리자에게 문의해 주세요.")).toBeInTheDocument();
  });
});

function createAuthState(overrides: { selectProfile: ReturnType<typeof vi.fn> }) {
  return {
    account: { accountIdx: 7, userId: "family01", username: "보호자", email: "" },
    createProfile: vi.fn(),
    error: undefined,
    isAccountAuthenticated: true,
    isLoading: false,
    profiles: [firstProfile],
    refreshProfiles: vi.fn().mockResolvedValue(undefined),
    selectProfile: overrides.selectProfile
  };
}

function renderProfileSelect() {
  render(
    <MemoryRouter initialEntries={["/profiles"]}>
      <Routes>
        <Route path="/profiles" element={<ProfileSelectPage />} />
        <Route path="/" element={<p>학습 홈</p>} />
        <Route path="/login" element={<p>로그인</p>} />
      </Routes>
    </MemoryRouter>
  );
}
