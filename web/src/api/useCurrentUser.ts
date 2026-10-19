import { useQuery } from '@tanstack/react-query';
import { api } from './client';

/** All consumers share the existing session query and its cache key. */
export function useCurrentUser() {
  return useQuery({ queryKey: ['me'], queryFn: api.me });
}
