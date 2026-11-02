-- HU-018: record transitions are distinct from account activation or subscription changes.
-- Retain every previous action and event. No data rewrite or additional runtime grants.
ALTER TABLE private.access_events DROP CONSTRAINT ck_access_events_action;
ALTER TABLE private.access_events ADD CONSTRAINT ck_access_events_action CHECK (action IN (
  'credentials_changed','invitation_issued','invitation_revoked','account_activated',
  'reset_issued','password_reset','emergency_reset_issued',
  'client_record_activated','client_record_inactivated'
));
