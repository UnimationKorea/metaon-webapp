import { ActType } from "../types/metaonTypes";

export type ActPortStatus = "implemented" | "compatible-renderer" | "planned" | "web-replacement";

export type ActTypeDefinition = {
  actType: ActType;
  unityName: string;
  label: string;
  category: "word" | "sentence" | "story" | "video" | "book" | "quiz" | "tool" | "external";
  status: ActPortStatus;
  webStrategy: string;
};

export const unityActTypeDefinitions: ActTypeDefinition[] = [
  def(ActType.VocaPreview, "VocaPreview", "Vocabulary Preview", "word", "implemented", "Use flash-card word preview with cached image/audio."),
  def(ActType.StoryReview, "StoryReview", "Story Review", "story", "compatible-renderer", "Show cached story pages, scripts, and audio."),
  def(ActType.VocaQuiz, "VocaQuiz", "Voca Quiz", "word", "implemented", "Use package word quiz renderer."),
  def(ActType.VocaCheck, "VocaCheck", "Voca Check", "word", "implemented", "Use package word selection/check renderer."),
  def(ActType.SentenceCheck, "SentenceCheck", "Sentence Blank", "sentence", "implemented", "Use cached sentence audio with blank-token answer choices."),
  def(ActType.SentenceUnscramble, "SentenceUnscramble", "Sentence Unscramble", "sentence", "implemented", "Use sentence token builder."),
  def(ActType.MatchingGame, "WDPL01", "Matching Game", "word", "implemented", "Use cached word image/audio as an image-to-word matching activity."),
  def(ActType.SentenceShadowing, "STRC01", "Sentence Record", "sentence", "implemented", "Use browser MediaRecorder with sentence audio."),
  def(ActType.Writing, "Writing", "Writing", "sentence", "compatible-renderer", "Use sentence/word input renderer."),
  def(ActType.MoviePlay, "MoviePlay", "Movie", "video", "implemented", "Use HTML video with remote or cached MP4."),
  def(ActType.Chant, "Chant", "Chant", "video", "compatible-renderer", "Use HTML video/audio from package metadata."),
  def(ActType.MemoryGame, "WDPL02", "Memory Card", "word", "implemented", "Use cached word image/audio as paired memory cards."),
  def(ActType.Ebook, "Ebook", "Ebook", "book", "implemented", "Use cached book page image renderer."),
  def(ActType.FlashCard, "FlashCard", "Flash Card", "word", "implemented", "Use cached flash cards with image/audio and reveal state."),
  def(ActType.NeopenNote, "NeopenNote", "Neopen Note", "external", "web-replacement", "Requires browser handwriting/input replacement."),
  def(ActType.GameSpace, "Game_Space", "Space Game", "word", "implemented", "Use cached word image/audio with a web choice-game replacement."),
  def(ActType.SoundWord, "Sound_Word", "Sound Word", "word", "implemented", "Use cached word audio and image resources in flash-card form."),
  def(ActType.Youtube, "Youtube", "YouTube", "video", "compatible-renderer", "Use iframe or direct link renderer."),
  def(ActType.SoundCheck, "Sound_Check", "Sound Check", "word", "implemented", "Use cached word audio check renderer."),
  def(ActType.SpellingCheck, "Spelling_Check", "Spelling Check", "word", "implemented", "Use word spelling input renderer."),
  def(ActType.Dictation, "Dictation", "Dictation", "sentence", "compatible-renderer", "Use sentence audio and input renderer."),
  def(ActType.FlashCard2, "FlashCard_2", "Flash Card 2", "word", "implemented", "Use cached flash cards with image/audio and reveal state."),
  def(ActType.WordPuzzle, "Word_Puzzle", "Word Puzzle", "word", "implemented", "Use cached word image/audio with scrambled letter selection."),
  def(ActType.WordSearch, "Word_Search", "Word Search", "word", "implemented", "Use cached word list in a generated selectable letter grid."),
  def(ActType.SoundCheckPen, "Sound_Check_Pen", "Sound Check Pen", "external", "web-replacement", "Requires browser pen/handwriting replacement."),
  def(ActType.WriteQuiz, "Write_Quiz", "Write Quiz", "word", "implemented", "Use cached word input renderer."),
  def(ActType.MonthTest, "Month_Test", "Month Test", "quiz", "planned", "Requires assessment state and scoring model."),
  def(ActType.ListenRecord, "Listen_Record", "Listen & Record", "word", "implemented", "Use browser MediaRecorder and package audio."),
  def(ActType.WorkBook, "WorkBook", "Workbook", "book", "planned", "Requires workbook-specific JSON renderer."),
  def(ActType.TextBook, "TextBook", "Textbook", "book", "planned", "Requires textbook-specific page renderer."),
  def(ActType.FindImage, "Find_Image", "Find Image", "quiz", "planned", "Requires image target hit-test rules."),
  def(ActType.DrawBoard, "Draw_Board", "Draw Board", "tool", "web-replacement", "Use HTML canvas drawing tool."),
  def(ActType.MultiLink, "Multi_Link", "Multi Link", "external", "planned", "Requires link/action metadata renderer."),
  def(ActType.MovieRecord, "MovieRecord", "Movie Record", "video", "web-replacement", "Use video plus browser recording."),
  def(ActType.PointPlay, "PointPlay", "Point Play", "quiz", "planned", "Requires point interaction metadata."),
  def(ActType.AudioList, "AudioList", "Audio List", "video", "compatible-renderer", "Use HTML audio playlist."),
  def(ActType.VideoList, "VideoList", "Video List", "video", "compatible-renderer", "Use HTML video playlist."),
  def(ActType.SpeakRecog, "Speak_Recog", "Speech Recognition", "external", "web-replacement", "Use server recognition proxy."),
  def(ActType.SpeakRecogSentence, "Speak_Recog_Sentence", "Sentence Speech Recognition", "external", "web-replacement", "Use server recognition proxy."),
  def(ActType.SpeakRecogStory, "Speak_Recog_Story", "Story Speech Recognition", "external", "web-replacement", "Use server recognition proxy."),
  def(ActType.QuizShow, "QuizShow", "Quiz Show", "quiz", "planned", "Requires quiz-show specific scoring UI."),
  def(ActType.FlipImage, "FlipImage", "Flip Image", "quiz", "planned", "Requires flip image metadata renderer."),
  def(ActType.BookPage, "BookPage", "Preview", "book", "implemented", "Use cached bookpage images and metadata."),
  def(ActType.PeelingWord, "PeelingWord", "Peeling Word", "word", "implemented", "Use cached word image/audio with progressive letter reveal."),
  def(ActType.WriteWord, "WriteWord", "Write Word", "word", "implemented", "Use cached word image/audio and text input."),
  def(ActType.PowerPoint, "PowerPoint", "PowerPoint", "book", "planned", "Requires slide-like package renderer."),
  def(ActType.WordBox, "WordBox", "Word Box", "word", "implemented", "Use cached word cards."),
  def(ActType.StoryBook, "StoryBook", "Story Book", "story", "compatible-renderer", "Use cached story pages and script audio."),
  def(ActType.ImageQuiz, "ImageQuiz", "Image Quiz", "quiz", "planned", "Requires image quiz metadata renderer."),
  def(ActType.WordPuzzle2, "WordPuzzle2", "Word Puzzle 2", "word", "implemented", "Use cached word image/audio with scrambled letter selection."),
  def(ActType.DragImage, "DragImage", "Drag Image", "quiz", "planned", "Requires drag/drop target metadata."),
  def(ActType.ImagePage, "ImagePage", "Image Page", "book", "compatible-renderer", "Use cached image page renderer."),
  def(ActType.SpinAndRead, "Spin_And_Read", "Spin & Read", "sentence", "compatible-renderer", "Use sentence package data with simplified selection."),
  def(ActType.ReadAndFlip, "Read_And_Flip", "Read & Flip", "sentence", "implemented", "Use read_n_flip JSON renderer."),
  def(ActType.CatchImage, "Catch_Image", "Catch Image", "quiz", "planned", "Requires catch image game rules."),
  def(ActType.UnderSea, "UnderSea", "Spelling Fish", "word", "implemented", "Use cached word image/audio in a fish-and-alphabet-bubble spelling game."),
  def(ActType.ARQuiz, "ARQuiz", "AR Quiz", "external", "web-replacement", "Requires non-AR browser replacement."),
  def(ActType.OMR, "OMR", "OMR", "external", "web-replacement", "Requires browser camera/upload or form replacement."),
  def(ActType.WritingAct, "WritingAct", "Writing Activity", "external", "web-replacement", "Requires handwriting/canvas replacement."),
  def(ActType.QuickCheck, "QCHK01", "Quick Check", "quiz", "implemented", "Use MetaOn3 quick-check API and submit quizaccept results."),
  def(ActType.Reading, "EBOOK01", "Listen & Read", "story", "implemented", "Use cached story pages and audio."),
  def(ActType.Listening, "EBOOK01", "Listen & Read", "book", "implemented", "Use the cached page-based ebook viewer as the primary renderer, with legacy MP4 fallback."),
  def(ActType.Phonics1, "Phonics_01", "Phonics 1", "word", "planned", "Requires phonics-specific package renderer."),
  def(ActType.Phonics2, "Phonics_02", "Phonics 2", "word", "planned", "Requires phonics-specific package renderer."),
  def(ActType.ResizeRead, "ResizeRead", "Resize Read", "story", "compatible-renderer", "Use cached reading/story renderer as the first web replacement."),
  def(ActType.DrawSave, "DrawSave", "Draw Save", "tool", "web-replacement", "Use HTML canvas drawing and IndexedDB/server upload replacement."),
  def(ActType.CameraWord, "CameraWord", "Camera Word", "external", "web-replacement", "Requires browser camera/upload replacement."),
  def(ActType.TimerDraw, "TimerDraw", "Timer Draw", "tool", "web-replacement", "Use timed HTML canvas drawing replacement."),
  def(ActType.TempletQuiz, "TempletQuiz", "Template Quiz", "quiz", "planned", "Requires template quiz metadata renderer."),
  def(ActType.KeyWord, "KeyWord", "Key Word", "word", "compatible-renderer", "Use cached word card renderer as the first web replacement."),
  def(ActType.TempletQuiz2, "TempletQuiz2", "Template Quiz 2", "quiz", "planned", "Requires template quiz metadata renderer."),
  def(ActType.ScratchWord, "ScratchWord", "Scratch Word", "word", "compatible-renderer", "Use cached word renderer until scratch interaction is ported."),
  def(ActType.QuickQuiz, "QuickQuiz", "Quick Quiz", "quiz", "planned", "Requires quick quiz metadata and scoring renderer."),
  def(ActType.RolePlay, "RolePlay", "Role Play", "sentence", "web-replacement", "Use browser recorder/recognition replacement."),
  def(ActType.PhonicsBlandSimple, "PhonicsBlandSimple", "Phonics Blend", "word", "planned", "Requires phonics blend renderer."),
  def(ActType.SimpleFlashCard, "SimpleFlashCard", "Simple Flash Card", "word", "implemented", "Use cached flash cards with image/audio and reveal state."),
  def(ActType.VocaQuizSpace, "WDQU01", "Word Quiz", "word", "implemented", "Use package word quiz renderer."),
  def(ActType.VocaCheckSpace, "WDBL01", "Word Blank", "word", "implemented", "Use package word selection/check renderer."),
  def(ActType.SentenceCheckSpace, "STBL01", "Sentence Blank", "sentence", "implemented", "Use cached sentence audio with blank-token answer choices."),
  def(ActType.SentenceUnscrambleSpace, "STSC01", "Unscramble", "sentence", "implemented", "Use sentence tokens with shuffled answer choices."),
  def(ActType.SentenceShadowingSpace, "STRC01", "Sentence Record", "sentence", "implemented", "Use browser MediaRecorder with sentence audio."),
  def(ActType.FlashCardSpace, "WDCA01", "Word Card", "word", "implemented", "Use cached flash cards with image/audio and reveal state."),
  def(ActType.MultyWordCard, "MultyWordCard", "Multi Word Card", "word", "compatible-renderer", "Use cached word cards as the first web replacement."),
  def(ActType.MultyWordFind, "MultyWordFind", "Multi Word Find", "word", "compatible-renderer", "Use cached word choice/search renderer as the first web replacement."),
  def(ActType.ListenRecordSpace, "Listen_Record_Space", "Word Record", "word", "implemented", "Use browser MediaRecorder and package audio."),
  def(ActType.StoryBookSpace, "StoryBook_Space", "Story Book", "story", "compatible-renderer", "Use cached story pages and script audio."),
  def(ActType.Reading1, "Reading_1", "Reading Activity 1", "story", "planned", "Requires reading_1101 metadata renderer."),
  def(ActType.Reading2, "Reading_2", "Story Check", "quiz", "implemented", "Use reading_1201 quiz JSON renderer."),
  def(ActType.Reading3, "Reading_3", "Reading Activity 3", "story", "planned", "Requires reading_1301 metadata renderer."),
  def(ActType.Reading4, "Reading_4", "Reading Activity 4", "story", "planned", "Requires reading_1401 metadata renderer."),
  def(ActType.Reading5, "Reading_5", "Sequencing", "sentence", "implemented", "Use reading_1501 sequence JSON renderer.")
];

const actTypeMap = new Map(unityActTypeDefinitions.map((item) => [item.actType, item]));

export const allUnityActTypes = unityActTypeDefinitions.map((item) => item.actType);

export function getActTypeDefinition(actType?: ActType): ActTypeDefinition | undefined {
  return actType == null ? undefined : actTypeMap.get(actType);
}

export function getActTypeLabel(actType?: ActType): string {
  return getActTypeDefinition(actType)?.label || "Pending Activity";
}

function def(
  actType: ActType,
  unityName: string,
  label: string,
  category: ActTypeDefinition["category"],
  status: ActPortStatus,
  webStrategy: string
): ActTypeDefinition {
  return { actType, unityName, label, category, status, webStrategy };
}
