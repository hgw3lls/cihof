import type { VideoSource } from '../data/types';
import { isYouTubeSearchUrl } from '../data/media';

const VideoGallery = ({ videos }: { videos: VideoSource[] }) => {
  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="modal-videos">
      <h3>Videos</h3>
      <div className="video-grid">
        {videos.map((video) => {
          if (video.kind === 'local') {
            return (
              <video key={video.src} controls preload="metadata">
                <source src={video.src} />
                Your browser does not support the video tag.
              </video>
            );
          }
          if (video.kind === 'youtube') {
            const embedSrc = `https://www.youtube.com/embed/${video.src}`;
            return (
              <iframe
                key={video.src}
                src={embedSrc}
                title="Inductee video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            );
          }
          if (isYouTubeSearchUrl(video.src)) {
            return (
              <a
                key={video.src}
                href={video.src}
                className="video-link"
                target="_blank"
                rel="noreferrer"
              >
                Search on YouTube
              </a>
            );
          }
          return (
            <a
              key={video.src}
              href={video.src}
              className="video-link"
              target="_blank"
              rel="noreferrer"
            >
              Watch video
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default VideoGallery;
