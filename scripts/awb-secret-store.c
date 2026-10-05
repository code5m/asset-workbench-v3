#include <libsecret/secret.h>
#include <stdio.h>
#include <string.h>

static const SecretSchema schema = {
  "com.ainfinit.asset-workbench.provider", SECRET_SCHEMA_NONE,
  { { "provider", SECRET_SCHEMA_ATTRIBUTE_STRING }, { "field", SECRET_SCHEMA_ATTRIBUTE_STRING }, { NULL, 0 } }
};

int main(int argc, char **argv) {
  if (argc != 4) return 64;
  const char *action = argv[1], *provider = argv[2], *field = argv[3];
  GError *error = NULL;
  if (strcmp(action, "set") == 0) {
    char secret[8192]; size_t n = fread(secret, 1, sizeof(secret) - 1, stdin); secret[n] = '\0';
    if (n > 0 && secret[n - 1] == '\n') secret[n - 1] = '\0';
    gboolean ok = secret_password_store_sync(&schema, SECRET_COLLECTION_DEFAULT, "Asset Workbench Provider Credential", secret, NULL, &error, "provider", provider, "field", field, NULL);
    if (!ok) { if (error) g_error_free(error); return 1; } return 0;
  }
  if (strcmp(action, "get") == 0) {
    gchar *secret = secret_password_lookup_sync(&schema, NULL, &error, "provider", provider, "field", field, NULL);
    if (error) { g_error_free(error); return 1; }
    if (!secret) return 2; fputs(secret, stdout); secret_password_free(secret); return 0;
  }
  if (strcmp(action, "delete") == 0) {
    gboolean ok = secret_password_clear_sync(&schema, NULL, &error, "provider", provider, "field", field, NULL);
    if (!ok && error) { g_error_free(error); return 1; } return 0;
  }
  if (strcmp(action, "has") == 0) {
    gchar *secret = secret_password_lookup_sync(&schema, NULL, &error, "provider", provider, "field", field, NULL);
    if (error) { g_error_free(error); return 1; } if (!secret) return 2; secret_password_free(secret); return 0;
  }
  return 64;
}
