import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { RouteErrorPage } from './RouteErrorPage';
import './styles/global.css';
import { preloadInvitationPhoto } from './guest/photos';

preloadInvitationPhoto(window.location.pathname);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});
const router = createBrowserRouter([
  { path: '*', element: <App />, errorElement: <RouteErrorPage /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
