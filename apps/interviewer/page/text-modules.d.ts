// esbuild bundles a .txt file as its text.
declare module '*.txt' {
  const text: string;
  export default text;
}
