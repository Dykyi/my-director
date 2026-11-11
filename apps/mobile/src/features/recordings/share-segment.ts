import { Share } from 'react-native';

/** iOS hands the local file itself to the share sheet, where Save Video puts it in Photos. */
export async function shareSegment(uri: string): Promise<void> {
  await Share.share({ url: uri });
}
