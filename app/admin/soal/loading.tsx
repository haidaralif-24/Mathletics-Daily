import { SoalListSkeleton } from './skeletons';

/**
 * Loading state untuk `/admin/soal` dan halaman di bawahnya
 * (docs/UI_GUIDE.md: setiap layar punya loading, empty, dan error state).
 */
export default function Loading() {
  return <SoalListSkeleton />;
}
