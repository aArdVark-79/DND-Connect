// Entry point. Wires the modules together in the same order the original
// monolithic script ran in:
//   1. create the Supabase client        (happens on import of config/supabase.js)
//   2. obtain DOM references + register event listeners (each init*() call)
//   3. restore session identity
//   4. check maintenance mode
//   5. load listings + subscribe to realtime, but ONLY if the site is open
//      (both of those live inside maintenance.js's showRealSite(), so they
//      can never accidentally run while maintenance mode is active)
//
// This file intentionally contains no feature logic of its own -- just
// initialization calls, each one imported from the module that owns it.
import './config/supabase.js';

import { initBoard } from './board/listings.js';
import { initAllyActions } from './board/allyActions.js';
import { initReports } from './help/reports.js';
import { initBook } from './book/book.js';
import { initPost } from './book/post.js';
import { initSubmissions } from './book/submissions.js';
import { initInterests } from './book/interests.js';
import { initAllies } from './book/allies.js';
import { initDice } from './features/dice.js';
import { restoreIdentity } from './auth/identity.js';
import { initMaintenanceCheck } from './maintenance/maintenance.js';

// --- obtain DOM references + register event listeners ---
// Each init*() call is only ever made once here, so no listener or
// realtime subscription can end up registered twice.
initBoard();
initAllyActions();
initReports();
initBook();
initPost();
initSubmissions();
initInterests();
initAllies();
initDice();

// --- restore session identity ---
restoreIdentity();

// --- check maintenance mode (loads listings + realtime only if open) ---
initMaintenanceCheck();
