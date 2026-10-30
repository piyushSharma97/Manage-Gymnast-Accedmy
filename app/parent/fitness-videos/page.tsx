'use client';

import { useParentSelectedStudent } from '@/components/providers/parent-selected-student-provider';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play } from 'lucide-react';
import Link from 'next/link';

type YoutubeVideo = {
  id: number;
  link: string;
  title: string | null;
  thumbnailUrl: string | null;
  description: string | null;
};

/** Extract YouTube video ID from various URL formats */
function getYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  // youtu.be/VIDEO_ID
  const shortMatch = trimmed.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  // youtube.com/embed/VIDEO_ID or youtube.com/shorts/VIDEO_ID
  const embedMatch = trimmed.match(/(?:youtube\.com\/(?:embed|shorts)\/)([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  return null;
}

export default function ParentFitnessVideosPage() {
  const { selectedStudentId: studentId, isReady } = useParentSelectedStudent();

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-youtube-videos', studentId],
    queryFn: async () => {
      const res = await apiFetch(
        withParams(API_PATHS.parent.youtubeVideos, `studentId=${studentId}`),
      );
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: isReady && !!studentId,
  });

  if (!isReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!studentId) {
    return (
      <Container width="fluid" className="py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-muted-foreground mb-4">Select a child to view fitness videos.</p>
          <Link href="/parent/children" className="text-primary font-medium hover:underline">
            Select child &rarr;
          </Link>
        </div>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Container width="fluid" className="py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-destructive">Could not load fitness videos.</p>
          <Link href="/parent" className="text-primary mt-2 inline-block">Back</Link>
        </div>
      </Container>
    );
  }

  const videos = (data?.data ?? []) as YoutubeVideo[];
  const validVideos = videos.filter((v) => getYoutubeVideoId(v.link));

  return (
    <Container width="fluid" className="py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-6">
        <Play className="size-5 text-primary" />
        <h1 className="text-2xl font-semibold">Fitness Videos</h1>
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fitness training videos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Watch fitness videos shared by your academy. These videos are view-only; you cannot edit or remove them.
          </p>
        </CardHeader>
      </Card>

      {validVideos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No fitness videos available yet. Your academy will add videos for you to watch here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
          {validVideos.map((video) => {
            const videoId = getYoutubeVideoId(video.link);
            if (!videoId) return null;
            return (
              <Card key={video.id} className="overflow-hidden">
                <div className="relative aspect-video w-full">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={video.title || video.description || `Video ${video.id}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
                {(video.title || video.description) && (
                  <CardHeader className="pt-4 pb-2">
                    <CardTitle className="text-base font-medium">
                      {video.title || video.description}
                    </CardTitle>
                  </CardHeader>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}
