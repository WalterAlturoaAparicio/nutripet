// Loads every module that plugs into shared extension points (day summary, tracking events, hooks).
// Imported by the journal service so a DaySummary is always complete, whatever route builds it.
// Order matters for tracking listeners: the calendar updates day state before the pet reads it.
import './activity/extension';
import './calendar/extension';
import './pet/extension';
