/**
 * What the display and the website build in place of editor.ts: nothing. The
 * staff portal's editing is not part of anything visitors run.
 */
export const editing = false;

export function useEditorBridge(_bridge: { reloadBundle: () => void; openPerson: (id: string) => void }) {}
