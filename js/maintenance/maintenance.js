// Maintenance mode: checks site_settings on load and shows either the
// maintenance screen or the real site. Only loads listings and subscribes
// to realtime updates once the real site is actually shown.
import { supabase } from '../config/supabase.js';
import { loadListings } from '../board/listings.js';
import { subscribeToListingChanges } from '../features/realtime.js';

function showRealSite() {
  document.getElementById('maintenanceScreen').style.display = 'none';
  document.getElementById('siteContent').style.display = 'block';
  loadListings();
  subscribeToListingChanges();
}

function showMaintenanceScreen() {
  document.getElementById('maintenanceScreen').style.display = 'flex';
  document.getElementById('siteContent').style.display = 'none';
}

export function initMaintenanceCheck() {
  let decided = false;
  const safetyTimer = setTimeout(() => {
    if (!decided) {
      decided = true;
      console.warn('Maintenance check timed out - staying closed by default.');
      showMaintenanceScreen();
    }
  }, 4000);

  (async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('maintenance')
        .eq('id', 1)
        .single();

      if (decided) return;
      clearTimeout(safetyTimer);
      decided = true;

      if (error) {
        console.error('Could not read maintenance setting:', error.message, error.code);
        showMaintenanceScreen();
        return;
      }

      if (data.maintenance) {
        showMaintenanceScreen();
      } else {
        showRealSite();
      }
    } catch (err) {
      console.error('Unexpected exception checking maintenance status:', err.message);
      if (decided) return;
      clearTimeout(safetyTimer);
      decided = true;
      showMaintenanceScreen();
    }
  })();
}
