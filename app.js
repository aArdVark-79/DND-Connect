// ============ APP ENTRY POINT ============
// Import order here doubles as wiring order: importing a module runs its
// top-level DOM-ref/listener setup exactly once (ES modules are singletons,
// so re-importing an already-loaded module below is a harmless no-op, not a
// duplicate listener). Nothing here should contain feature logic itself —
// see the individual modules for that.

import './config/supabase.js';       // 1. creates the Supabase client

// 2. wire up feature modules (grabs DOM refs, attaches listeners)
import './board/listings.js';        // also pulls in ./board/allyActions.js
import './board/allyActions.js';
import './help/reports.js';
import './book/book.js';
import './book/post.js';
import './book/verify.js';
import './book/submissions.js';
import './book/interests.js';
import './book/allies.js';
import './features/dice.js';

import { restoreIdentity } from './auth/identity.js';
import { runMaintenanceCheck } from './maintenance/maintenance.js';

// 3. restore session identity (if any)
restoreIdentity();

// 4. run the maintenance check — this internally loads the board and
//    starts the realtime subscription (steps 5 & 6) ONLY when the site
//    is open, so listings are never fetched while maintenance is active.
runMaintenanceCheck();
