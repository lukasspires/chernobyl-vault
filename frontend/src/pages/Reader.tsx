import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { PageViewer } from '../components/PageViewer';

export function Reader() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const id = Number(chapterId);
  const validId = Number.isInteger(id) && id > 0;
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState(false);

  const { data: loadResult, isLoading } = useQuery({
    queryKey: ['chapter', id],
    queryFn: async () => {
      try {
        return { chapter: await api.getChapter(id), error: null };
      } catch (error) {
        return { chapter: null, error: error instanceof Error ? error.message : 'Não foi possível carregar o capítulo.' };
      }
    },
    enabled: validId,
  });
  const chapter = loadResult?.chapter;
  const loadError = loadResult?.error;

  if (!validId || loadError) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col gap-4 items-center justify-center text-white">
        <p>{!validId ? 'Capítulo inválido.' : loadError}</p>
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 rounded bg-violet-600">Voltar</button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="fixed inset-0 bg-black flex items-center justify-center text-white">Carregando...</div>;
  }

  if (!chapter || chapter.page_count <= 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col gap-4 items-center justify-center text-white">
        <p>Este capítulo não possui páginas disponíveis.</p>
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 rounded bg-violet-600">Voltar</button>
      </div>
    );
  }

  return (
    <>
      <PageViewer
        chapterId={chapter.id}
        pageCount={chapter.page_count}
        initialPage={Math.min(chapter.progress_page ?? 0, chapter.page_count - 1)}
        onPageChange={(page) => {
          setSaveError(false);
          api.saveProgress(chapter.id, page).catch(() => setSaveError(true));
        }}
        onClose={() => navigate(-1)}
      />
      {saveError ? (
        <div role="alert" className="fixed bottom-4 right-4 z-[60] rounded bg-red-700 px-4 py-2 text-sm text-white">
          Não foi possível salvar o progresso.
        </div>
      ) : null}
    </>
  );
}
