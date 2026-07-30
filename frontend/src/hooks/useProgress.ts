import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../api';

export function useProgress(chapterId: number) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (page: number) => api.saveProgress(chapterId, page),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapter', chapterId] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });

  const save = useCallback((page: number) => {
    saveMutation.mutate(page);
  }, [saveMutation]);

  return { save, isSaving: saveMutation.isPending };
}
