import type { Inductee } from '../data/types';
import MediaGallery from './MediaGallery';
import VideoGallery from './VideoGallery';

const InducteeDetailModal = ({
  inductee,
  placeholder,
  onClose,
  variant = 'default',
}: {
  inductee: Inductee;
  placeholder: string;
  onClose: () => void;
  variant?: 'default' | 'brutalist';
}) => {
  const isBrutalist = variant === 'brutalist';
  return (
    <div
      className={`modal-backdrop${isBrutalist ? ' modal-backdrop--brutalist' : ''}`}
      role="dialog"
      aria-modal="true"
    >
      <div className={`modal${isBrutalist ? ' modal--brutalist' : ''}`}>
        <button
          className={`modal-close${isBrutalist ? ' modal-close--brutalist' : ''}`}
          onClick={onClose}
          aria-label="Close"
        >
          {isBrutalist ? 'CLOSE' : 'Close'}
        </button>
        <div className={`modal-header${isBrutalist ? ' modal-header--brutalist' : ''}`}>
          <div>
            <h2>{inductee.name}</h2>
            {isBrutalist ? (
              <div className="modal-meta-row">
                <span>Year {inductee.class_year}</span>
                <span>{inductee.region}</span>
                {inductee.inducted_by && <span>Inducted by: {inductee.inducted_by}</span>}
              </div>
            ) : (
              <>
                <p className="modal-meta">
                  Class of {inductee.class_year} · {inductee.region}
                </p>
                {inductee.inducted_by && (
                  <p className="modal-meta">Inducted by: {inductee.inducted_by}</p>
                )}
              </>
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

        {isBrutalist ? (
          <div className="modal-body">
            <section className="modal-section">
              <h3>Images</h3>
              <MediaGallery
                images={inductee.images}
                placeholder={placeholder}
                alt={inductee.name}
                variant="brutalist"
              />
            </section>
            <section className="modal-section modal-section--bio">
              <h3>Bio</h3>
              <div className="modal-bio">
                <p>{inductee.bio_text || 'Biography details coming soon.'}</p>
              </div>
            </section>
            <section className="modal-section">
              <VideoGallery videos={inductee.videos} heading="Video" />
            </section>
          </div>
        ) : (
          <>
            <div className="modal-content">
              <MediaGallery images={inductee.images} placeholder={placeholder} alt={inductee.name} />
              <div className="modal-bio">
                <h3>Biography</h3>
                <p>{inductee.bio_text || 'Biography details coming soon.'}</p>
              </div>
            </div>

            <VideoGallery videos={inductee.videos} />
          </>
        )}
      </div>
    </div>
  );
};

export default InducteeDetailModal;
