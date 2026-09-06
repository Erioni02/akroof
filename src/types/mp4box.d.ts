/**
 * mp4box ships no types. We only touch a handful of members and the calls are
 * already guarded, so a loose module declaration is honest about that.
 */
declare module 'mp4box' {
  const MP4Box: any
  export default MP4Box
  export const DataStream: any
  export function createFile(): any
}
