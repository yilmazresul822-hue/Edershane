export type BankQuestion = {
  id: string; hash: string; zorluk: number;
  stem: string; secenekler: string[]; dogruIndex: number;
  steps: { latex: string; note: string }[];
};
