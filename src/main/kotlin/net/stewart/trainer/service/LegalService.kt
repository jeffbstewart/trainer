package net.stewart.trainer.service

import com.github.vokorm.findAll
import net.stewart.trainer.entity.AppConfig
import net.stewart.trainer.entity.AppUser
import org.slf4j.LoggerFactory

/**
 * Tracks required legal document versions and user compliance.
 * Versions are stored in app_config; user agreement versions in app_user.
 */
object LegalService {
    private val log = LoggerFactory.getLogger(LegalService::class.java)

    @Volatile var requiredPrivacyPolicyVersion: Int = 0; private set
    @Volatile var requiredTermsOfUseVersion: Int = 0; private set
    @Volatile var privacyPolicyUrl: String? = null; private set
    @Volatile var termsOfUseUrl: String? = null; private set

    /** Load required versions from app_config. Call on startup and after admin updates. */
    fun refresh() {
        val configs = AppConfig.findAll().associateBy { it.config_key }
        requiredPrivacyPolicyVersion = configs["privacy_policy_version"]?.config_val?.toIntOrNull() ?: 0
        requiredTermsOfUseVersion = configs["terms_of_use_version"]?.config_val?.toIntOrNull() ?: 0
        privacyPolicyUrl = configs["privacy_policy_url"]?.config_val?.takeIf { it.isNotBlank() }
        termsOfUseUrl = configs["terms_of_use_url"]?.config_val?.takeIf { it.isNotBlank() }
        log.info("Legal requirements: pp_version={} tou_version={}", requiredPrivacyPolicyVersion, requiredTermsOfUseVersion)
    }

    /** Returns true if legal document versions are configured and enforcement is active. */
    fun isEnforcing(): Boolean = requiredPrivacyPolicyVersion > 0 || requiredTermsOfUseVersion > 0

    /** Check if a user has agreed to all current required versions. */
    fun isCompliant(user: AppUser): Boolean {
        if (user.isAdmin()) return true
        if (!isEnforcing()) return true

        if (requiredPrivacyPolicyVersion > 0) {
            val agreed = user.privacy_policy_version ?: return false
            if (agreed < requiredPrivacyPolicyVersion) return false
        }
        if (requiredTermsOfUseVersion > 0) {
            val agreed = user.terms_of_use_version ?: return false
            if (agreed < requiredTermsOfUseVersion) return false
        }
        return true
    }
}
