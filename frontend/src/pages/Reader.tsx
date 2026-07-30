import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { PageViewer } from '../components/PageViewer';

export function Reader() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const id = Number(chapterId);
  const navigate = useNavigate();

  const { data: chapter, isLoading } = useQuery({
    queryKey: ['chapter', id],
    queryFn: () => api.getChapter(id),
    enabled: !Number.isNaN(id),
  });

  if (isLoading || !chapter) {
    return <div className="fixed inset-0 bg-black flex items-center justify-center text-white">Carregando...</div>;
  }

  return (
    <PageViewer
      chapterId={chapter.id}
      pageCount={chapter.page_count}
      initialPage={chapter.progress_page ?? 0}
      onPageChange={(page) => {
        api.saveProgress(chapter.id, page).catch(() => {});
      }}
      onClose={() => navigate(-1)}
    />
  );
}
