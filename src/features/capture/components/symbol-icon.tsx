import { Image } from 'expo-image';

export function SymbolIcon({ name, size, color }: { name: string; size: number; color: string }) {
  return <Image source={`sf:${name}`} tintColor={color} style={{ width: size, height: size }} />;
}
