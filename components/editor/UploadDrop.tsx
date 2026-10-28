/**
 * Where a tape's upload drop zone goes. Task 4 builds it; until then it
 * renders nothing. `disabled` is true while a delete covering the tape is
 * in its undo hour, when the server would refuse the upload anyway.
 */
export function UploadDrop(props: { tapeId: number; disabled: boolean; onUploaded: () => void }) {
  void props;
  return null;
}
