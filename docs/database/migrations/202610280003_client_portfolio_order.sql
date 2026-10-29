-- Cursor traversal within one professional, including deterministic timestamp ties.
-- Keep the existing professional index; no new extension, grants or data rewrite.
CREATE INDEX idx_clients_portfolio_order ON private.clients (professional_id,created_at DESC,id DESC);
