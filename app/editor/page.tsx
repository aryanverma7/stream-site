import { EditorShell } from "@/components/editor/EditorShell";
import { TransfersPanel } from "@/components/editor/TransfersPanel";

/**
 * The editor app. Gated by the backend's auth middleware, not here; where
 * you are inside it lives in the hash.
 */
export default function EditorPage() {
  return <EditorShell transfers={<TransfersPanel />} />;
}
