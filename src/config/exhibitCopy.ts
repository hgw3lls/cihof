// Curators may replace the invitation after review; blank or draft copy stays hidden.
export const exhibitCopy: { invitation: string; reviewStatus: 'draft' | 'approved' } = {
  invitation: '',
  reviewStatus: 'draft',
};

export const entryInvitation = exhibitCopy.reviewStatus === 'approved' && exhibitCopy.invitation.trim()
  ? exhibitCopy.invitation
  : 'Browse by contribution, community, or induction year, or search by name.';
