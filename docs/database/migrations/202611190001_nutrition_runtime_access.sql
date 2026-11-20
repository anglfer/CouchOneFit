-- Restore the restricted API role's access to client nutrition plans.
CREATE FUNCTION private.nutrition_can_write(owner uuid, target uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, private
AS $$
  SELECT private.nutrition_professional(owner) AND EXISTS (
    SELECT 1 FROM private.clients c
    JOIN private.professionals p ON p.id = c.professional_id
    WHERE c.id = target AND p.user_id = owner AND c.status = 'active'
  )
$$;

REVOKE ALL ON FUNCTION private.nutrition_can_write(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.nutrition_can_write(uuid, uuid) TO couchone_authentication;

GRANT SELECT ON private.nutrition_plans, private.nutrition_versions,
  private.nutrition_meals, private.nutrition_items, private.nutrition_active
  TO couchone_authentication;
GRANT INSERT (id, owner_id, client_id) ON private.nutrition_plans TO couchone_authentication;
GRANT INSERT (id, plan_id, number, document), UPDATE (document, revision, published)
  ON private.nutrition_versions TO couchone_authentication;
GRANT INSERT, DELETE ON private.nutrition_meals, private.nutrition_items TO couchone_authentication;
GRANT INSERT, UPDATE (plan_id, version_id, revision) ON private.nutrition_active TO couchone_authentication;
GRANT INSERT (client_id, plan_id, version_id, activated_at, local_date, time_zone, revision)
  ON private.nutrition_activations TO couchone_authentication;

CREATE POLICY nutrition_plans_insert ON private.nutrition_plans
  FOR INSERT TO couchone_authentication
  WITH CHECK (private.nutrition_can_write(owner_id, client_id));

ALTER POLICY nutrition_versions_read ON private.nutrition_versions
  USING (EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    WHERE p.id = nutrition_versions.plan_id
      AND (private.nutrition_professional(p.owner_id)
        OR (nutrition_versions.published AND private.nutrition_client_access(p.client_id)
          AND EXISTS (
            SELECT 1 FROM private.nutrition_active a
            WHERE a.client_id = p.client_id AND a.version_id = nutrition_versions.id
          )))
  ));

CREATE POLICY nutrition_versions_insert ON private.nutrition_versions
  FOR INSERT TO couchone_authentication
  WITH CHECK (NOT published AND EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    WHERE p.id = nutrition_versions.plan_id AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

CREATE POLICY nutrition_versions_update ON private.nutrition_versions
  FOR UPDATE TO couchone_authentication
  USING (NOT published AND EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    WHERE p.id = nutrition_versions.plan_id AND private.nutrition_can_write(p.owner_id, p.client_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    WHERE p.id = nutrition_versions.plan_id AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

CREATE POLICY nutrition_meals_write ON private.nutrition_meals
  FOR ALL TO couchone_authentication
  USING (EXISTS (
    SELECT 1 FROM private.nutrition_versions v
    JOIN private.nutrition_plans p ON p.id = v.plan_id
    WHERE v.id = nutrition_meals.version_id AND NOT v.published
      AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

CREATE POLICY nutrition_items_write ON private.nutrition_items
  FOR ALL TO couchone_authentication
  USING (EXISTS (
    SELECT 1 FROM private.nutrition_versions v
    JOIN private.nutrition_plans p ON p.id = v.plan_id
    WHERE v.id = nutrition_items.version_id AND NOT v.published
      AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

CREATE POLICY nutrition_active_write ON private.nutrition_active
  FOR ALL TO couchone_authentication
  USING (EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    WHERE p.id = nutrition_active.plan_id AND p.client_id = nutrition_active.client_id
      AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

CREATE POLICY nutrition_activations_insert ON private.nutrition_activations
  FOR INSERT TO couchone_authentication
  WITH CHECK (EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    JOIN private.nutrition_active a ON a.plan_id = p.id AND a.client_id = p.client_id
    WHERE a.client_id = nutrition_activations.client_id AND a.plan_id = nutrition_activations.plan_id
      AND a.version_id = nutrition_activations.version_id AND a.revision = nutrition_activations.revision
      AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));
