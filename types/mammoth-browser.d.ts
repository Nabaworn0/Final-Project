declare module "mammoth/mammoth.browser.js" {
  type Message = { type: "warning" | "error"; message: string };
  type Result = { value: string; messages: Message[] };
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<Result>;
  };
  export default mammoth;
}
