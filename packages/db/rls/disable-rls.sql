-- Rollback de la RLS multi-tenant (sans perte de donnees).
DO $$
DECLARE
  t text;
  all_tables text[] := ARRAY[
    'Organization','Constituency','User','Show','Story','MediaItem','Collection',
    'MontageProject','RundownTemplate','PoliticalTag','Invitation',
    'AIConversation','AIUsage','AISettings'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;
