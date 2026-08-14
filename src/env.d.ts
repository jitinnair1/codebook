/// <reference types="vite/client" />

declare module "*.md" {
    const content: string;
    export default content;
}
declare module "*.ml" {
    const content: string;
    export default content;
}
declare module "*.go" {
    const content: string;
    export default content;
}