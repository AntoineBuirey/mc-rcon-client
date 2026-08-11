#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct pam_handle pam_handle_t;

struct pam_message {
    int msg_style;
    const char *msg;
};

struct pam_response {
    char *resp;
    int resp_retcode;
};

struct pam_conv {
    int (*conv)(int num_msg, const struct pam_message **msg,
                struct pam_response **resp, void *appdata_ptr);
    void *appdata_ptr;
};

#define PAM_SUCCESS 0
#define PAM_SYSTEM_ERR 4
#define PAM_PROMPT_ECHO_OFF 1
#define PAM_PROMPT_ECHO_ON 2
#define PAM_CONV_ERR 19

extern int pam_start(const char *service_name, const char *user,
                     const struct pam_conv *pam_conversation,
                     pam_handle_t **pamh);
extern int pam_authenticate(pam_handle_t *pamh, int flags);
extern int pam_acct_mgmt(pam_handle_t *pamh, int flags);
extern int pam_end(pam_handle_t *pamh, int pam_status);
extern const char *pam_strerror(pam_handle_t *pamh, int errnum);

static const char *g_password = NULL;

static int conversation(int num_msg, const struct pam_message **msg,
                        struct pam_response **resp, void *appdata_ptr) {
    (void)msg;
    (void)appdata_ptr;

    struct pam_response *responses = calloc((size_t)num_msg, sizeof(struct pam_response));
    if (!responses) {
        return PAM_CONV_ERR;
    }

    for (int index = 0; index < num_msg; ++index) {
        responses[index].resp_retcode = 0;
        responses[index].resp = NULL;
        if (msg[index]->msg_style == PAM_PROMPT_ECHO_OFF || msg[index]->msg_style == PAM_PROMPT_ECHO_ON) {
            responses[index].resp = strdup(g_password ? g_password : "");
            if (!responses[index].resp) {
                for (int cleanup_index = 0; cleanup_index < index; ++cleanup_index) {
                    free(responses[cleanup_index].resp);
                }
                free(responses);
                return PAM_CONV_ERR;
            }
        }
    }

    *resp = responses;
    return PAM_SUCCESS;
}

static int authenticate_user(const char *service_name, const char *username, const char *password) {
    struct pam_conv conv = { conversation, NULL };
    pam_handle_t *pam_handle = NULL;
    int result = PAM_SYSTEM_ERR;

    g_password = password;

    result = pam_start(service_name, username, &conv, &pam_handle);
    if (result != PAM_SUCCESS) {
        goto done;
    }

    result = pam_authenticate(pam_handle, 0);
    if (result != PAM_SUCCESS) {
        goto done;
    }

    result = pam_acct_mgmt(pam_handle, 0);

done:
    if (pam_handle) {
        pam_end(pam_handle, result);
    }

    return result;
}

int main(int argc, char **argv) {
    if (argc != 4) {
        fprintf(stderr, "Usage: %s <service> <username> <password>\n", argv[0]);
        return 2;
    }

    int result = authenticate_user(argv[1], argv[2], argv[3]);
    if (result != PAM_SUCCESS) {
        fprintf(stderr, "%s\n", pam_strerror(NULL, result));
        return 1;
    }

    return 0;
}