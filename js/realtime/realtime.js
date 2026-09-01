// Live updates: listens for any change to the "listings" table (e.g.
// admin approves/rejects a submission, or someone edits their own listing
// back into review) and quietly re-fetches the board. Requires Realtime
// to be turned on for the "listings" table in the Supabase dashboard
// (Database -> Replication) -- this code alone can't enable that.
import { supabase } from '../config/supabase.js';
import { loadListings } from '../board/listings.js';

let realtimeSubscribed = false;
let listingsRefreshTimer = null;

export function subscribeToListingChanges() {
  if (realtimeSubscribed) return;
  realtimeSubscribed = true;
  supabase
    .channel('public:listings-board')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => {
      clearTimeout(listingsRefreshTimer);
      listingsRefreshTimer = setTimeout(loadListings, 400);
    })
    .subscribe();
}
