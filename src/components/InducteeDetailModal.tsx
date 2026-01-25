import type { Inductee } from '../data/types';
import MediaGallery from './MediaGallery';
import VideoGallery from './VideoGallery';

const InducteeDetailModal = ({
  inductee,
  placeholder,
  onClose,
}: {
  inductee: Inductee;
  placeholder: string;
  onClose: () => void;
}) => {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          Close
        </button>
        <div className="modal-header">
          <div>
            <h2>{inductee.name}</h2>
            <p className="modal-meta">
              Class of {inductee.class_year} · {inductee.region}
            </p>
            {inductee.inducted_by && (
              <p className="modal-meta">Inducted by: {inductee.inducted_by}</p>
            )}
          </div>
          {inductee.profile_url && (
            <a
              href={inductee.profile_url}
              target="_blank"
              rel="noreferrer"
              className="profile-link"
            >
              Full profile
            </a>
          )}
        </div>

        <div className="modal-content">
          <MediaGallery images={inductee.images} placeholder={placeholder} alt={inductee.name} />
          <div className="modal-bio">
            <h3>Biography</h3>
            <p>{inductee.bio_text || 'Biography details coming soon.'}</p>
          </div>
        </div>

        <VideoGallery videos={inductee.videos} />
      </div>
    </div>
  );
};

export default InducteeDetailModal;
