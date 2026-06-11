-- Row-Level Security multi-tenant — tables a `organizationId` direct.
--
-- ⚠️ NE PAS APPLIQUER sans avoir lu packages/db/rls/README.md et cable le
-- positionnement de `app.current_org` (voir packages/db/src/tenant.ts).
-- L'app doit se connecter avec un role NOBYPASSRLS (la RLS est ignoree pour le
-- proprietaire des tables et les superusers).
--
-- Idempotent : reexecutable sans erreur.

DO $$
DECLARE
  t text;
  org_tables text[] := ARRAY[
    'Constituency','User','Show','Story','MediaItem','Collection',
    'MontageProject','RundownTemplate','PoliticalTag','Invitation',
    'AIConversation','AIUsage','AISettings'
  ];
BEGIN
  FOREACH t IN ARRAY org_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format($pol$
      CREATE POLICY tenant_isolation ON %I
        USING ("organizationId" = current_setting('app.current_org', true))
        WITH CHECK ("organizationId" = current_setting('app.current_org', true));
    $pol$, t);
  END LOOP;
END $$;

-- La table racine `Organization` est scopee par sa propre cle primaire.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Organization";
CREATE POLICY tenant_isolation ON "Organization"
  USING ("id" = current_setting('app.current_org', true))
  WITH CHECK ("id" = current_setting('app.current_org', true));

-- TODO (voir README) : tables "org indirect" (Rundown, RundownItem, StoryMedia,
-- Comment, Montage*, etc.). A traiter apres denormalisation d'organizationId ou
-- via policies EXISTS sur le parent.
