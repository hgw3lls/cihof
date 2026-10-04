import { useEffect, useRef } from 'react';

/**
 * The exhibit inside the staff portal, which edits it in place.
 *
 * Only the portal's own copy of the exhibit is built with this (CIHOF_EDITOR=1).
 * The display's and the website's builds resolve this module to editor.stub.ts,
 * so none of it is in what visitors run: a check refuses either build if the
 * marker below is found in it.
 *
 * The portal shows the exhibit in a frame and talks to it by messages, from
 * its own origin only. It can switch editing on, which outlines everything
 * marked `data-edit` and turns a touch on it into a message saying what was
 * touched, instead of what a visitor's touch would do; reload the content
 * after a change, keeping the screen where it is; and open a person.
 */

export const editorMarker = 'cihof-editor-bridge';
/** The editor's exhibit never times out to the attract screen or caches a release. */
export const editing = true;

type Bridge = { reloadBundle: () => void; openPerson: (id: string) => void };

export function useEditorBridge({ reloadBundle, openPerson }: Bridge) {
  const handlers = useRef({ reloadBundle, openPerson });
  handlers.current = { reloadBundle, openPerson };

  useEffect(() => {
    const parent = window.parent;
    if (!parent || parent === window) return undefined;
    const post = (message: Record<string, unknown>) => parent.postMessage({ source: editorMarker, ...message }, window.location.origin);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== parent) return;
      const message = event.data as { source?: string; type?: string; edit?: boolean; id?: string };
      if (message?.source !== editorMarker) return;
      if (message.type === 'mode') document.documentElement.dataset.editing = message.edit ? 'true' : 'false';
      if (message.type === 'reload') handlers.current.reloadBundle();
      if (message.type === 'open-person' && typeof message.id === 'string') handlers.current.openPerson(message.id);
    };
    // Captured before the exhibit's own handlers, so in edit mode a touch on
    // something editable picks it, and does not also do what a visitor's would.
    const onClick = (event: MouseEvent) => {
      if (document.documentElement.dataset.editing !== 'true') return;
      const target = (event.target as Element | null)?.closest?.('[data-edit]');
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      post({ type: 'pick', kind: target.getAttribute('data-edit'), id: target.getAttribute('data-edit-id') ?? '' });
    };

    window.addEventListener('message', onMessage);
    document.addEventListener('click', onClick, true);
    post({ type: 'ready' });
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
    };
  }, []);
}
