/**
 * ParentSetupUI: DOM Controller for Parent Setup, Subscription Visibility & Onboarding
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ParentSetupUI = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function init() {
    const modal = document.getElementById('parent-setup-modal');
    if (!modal) return;

    const btnOpen = document.getElementById('btn-parent-setup');
    const btnClose = document.getElementById('btn-close-parent-setup');
    const btnHeroGetStarted = document.getElementById('btn-hero-primary-schedule');

    // Steps containers
    const stepAuth = document.getElementById('pos-step-auth');
    const stepPlan = document.getElementById('pos-step-plan');
    const stepChild = document.getElementById('pos-step-child');
    const stepPers = document.getElementById('pos-step-pers');
    const stepSuccess = document.getElementById('pos-step-success');
    const stepTracker = document.getElementById('pos-step-tracker');
    const alertBox = document.getElementById('pos-alert');

    // Forms & Controls
    const authForm = document.getElementById('pos-auth-form');
    const tabLogin = document.getElementById('pos-tab-login');
    const tabSignup = document.getElementById('pos-tab-signup');
    const authEmail = document.getElementById('pos-auth-email');
    const authPassword = document.getElementById('pos-auth-password');
    const authHousehold = document.getElementById('pos-auth-household');
    const authHouseholdWrap = document.getElementById('pos-household-wrap');
    const btnAuthSubmit = document.getElementById('pos-btn-auth-submit');

    const plansContainer = document.getElementById('pos-plans-container');
    const planStatusText = document.getElementById('pos-plan-status');

    const childListContainer = document.getElementById('pos-child-list');
    const childNewFormWrap = document.getElementById('pos-child-form-wrap');
    const childNewForm = document.getElementById('pos-child-form');
    const childNameInput = document.getElementById('pos-child-name');
    const childGradeSelect = document.getElementById('pos-child-grade');

    const persForm = document.getElementById('pos-pers-form');
    const persLang = document.getElementById('pos-pers-lang');
    const persStyle = document.getElementById('pos-pers-style');
    const persFont = document.getElementById('pos-pers-font');
    const persResponse = document.getElementById('pos-pers-response');
    const persTheme = document.getElementById('pos-pers-theme');
    const persInterests = document.getElementById('pos-pers-interests');
    const persSubjects = document.getElementById('pos-pers-subjects');
    const persGoals = document.getElementById('pos-pers-goals');

    const btnLaunchAppu = document.getElementById('pos-btn-launch');

    let isSignUpMode = false;
    let currentStep = 1;

    function showAlert(message, type = 'error') {
      if (!alertBox) return;
      alertBox.textContent = message;
      alertBox.className = `pos-alert ${type}`;
      alertBox.style.display = 'block';
    }

    function clearAlert() {
      if (!alertBox) return;
      alertBox.textContent = '';
      alertBox.style.display = 'none';
    }

    function setStep(step) {
      currentStep = step;
      clearAlert();

      if (stepAuth) stepAuth.style.display = step === 1 ? 'block' : 'none';

      if (stepPlan) stepPlan.style.display = step === 2 ? 'block' : 'none';
      if (stepChild) stepChild.style.display = step === 3 ? 'block' : 'none';
      if (stepPers) stepPers.style.display = step === 4 ? 'block' : 'none';
      if (stepSuccess) stepSuccess.style.display = step === 5 ? 'block' : 'none';

      // Update Step tracker dots
      if (stepTracker) {
        const dots = stepTracker.querySelectorAll('.pos-step-dot');
        dots.forEach((dot, index) => {
          if (index + 1 < step) {
            dot.className = 'pos-step-dot completed';
          } else if (index + 1 === step) {
            dot.className = 'pos-step-dot active';
          } else {
            dot.className = 'pos-step-dot';
          }
        });
      }
    }

    let lastFocusedElement = null;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function openModal(preferredStep) {
      lastFocusedElement = document.activeElement;
      modal.classList.add('is-visible');
      modal.setAttribute('aria-hidden', 'false');
      clearAlert();

      const shell = typeof window !== 'undefined' ? window.ParentOnboardingShell : null;
      const isAuthed = shell && shell.state.session;

      if (preferredStep === 1) {
        setStep(1);
      } else if (preferredStep === 2) {
        renderPlansStep();
      } else if (preferredStep === 3) {
        renderChildrenStep();
      } else if (isAuthed) {
        const sub = shell.state.subscription;
        if (sub && sub.status === 'ACTIVE') {
          // If child selection required or multiple learners, route to step 3
          if (shell.state.authStatus === 'CHILD_SELECTION_REQUIRED' || !shell.state.selectedChild) {
            renderChildrenStep();
          } else {
            renderPlansStep();
          }
        } else {
          renderPlansStep();
        }
      } else {
        setStep(1);
      }

      // If returning with email verification confirmation on a device without automatic session:
      if (!isAuthed && typeof window !== 'undefined' && window.location) {
        const hash = window.location.hash || '';
        if (hash.includes('type=signup') || hash.includes('type=email_verification')) {
          showAlert('Email verified successfully! Sign in with your password to continue your APPU setup.', 'success');
        }
      }

      // Place focus inside modal safely
      window.requestAnimationFrame(() => {
        if (modal.classList.contains('is-visible')) {
          if (btnClose && typeof btnClose.focus === 'function') {
            btnClose.focus();
          } else if (modal && typeof modal.focus === 'function') {
            modal.focus();
          }
        }
      });
    }

    function closeModal() {
      // Restore focus to opener element BEFORE setting aria-hidden='true' to avoid:
      // "Blocked aria-hidden on an element because its descendant retained focus."
      if (modal.contains(document.activeElement)) {
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function' && lastFocusedElement.isConnected) {
          lastFocusedElement.focus();
        } else if (btnOpen && typeof btnOpen.focus === 'function' && btnOpen.isConnected) {
          btnOpen.focus();
        } else if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
      }
      modal.classList.remove('is-visible');
      modal.setAttribute('aria-hidden', 'true');
    }

    if (btnOpen) btnOpen.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnHeroGetStarted) {
      btnHeroGetStarted.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    }

    // Modal background dismiss
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal();
      }
    });

    // -------------------------------------------------------------
    // Step 1: Auth Tabs & Form
    // -------------------------------------------------------------
    function renderVerificationView(email, householdName = 'Family') {
      clearAlert();
      let verifyWrap = document.getElementById('pos-verify-wrap');
      if (!verifyWrap) {
        verifyWrap = document.createElement('div');
        verifyWrap.id = 'pos-verify-wrap';
        if (stepAuth) stepAuth.appendChild(verifyWrap);
      }

      const tabsWrap = stepAuth?.querySelector('.pos-tabs');
      if (tabsWrap) tabsWrap.style.display = 'none';
      if (authForm) authForm.style.display = 'none';
      verifyWrap.style.display = 'block';

      verifyWrap.innerHTML = `
        <div id="pos-verify-container" class="pos-verify-card">
          <div class="pos-verify-icon-wrap">
            <i class="fa-solid fa-envelope-circle-check text-cyan"></i>
          </div>
          <h3 class="pos-verify-title">Check your email</h3>
          <p class="pos-verify-lead">
            We sent a verification link to <strong class="text-cyan">${escapeHtml(email)}</strong>. Open your inbox and click the link to verify your account.
          </p>
          <p class="pos-verify-sub">
            After verification, we'll bring you back to APPU and continue your setup.
          </p>
          <div id="pos-verify-feedback" class="pos-alert" style="display:none; width: 100%;"></div>
          <div class="pos-verify-actions">
            <button id="pos-btn-check-verification" class="primary-modal-btn" type="button">
              <i class="fa-solid fa-arrows-rotate"></i> I've verified my email
            </button>
            <button id="pos-btn-resend-verification" class="pos-secondary-btn" type="button">
              <i class="fa-solid fa-paper-plane"></i> Resend verification email
            </button>
            <button id="pos-btn-back-signin" class="pos-link-btn" type="button">
              Back to sign in
            </button>
          </div>
        </div>
      `;

      const btnCheck = document.getElementById('pos-btn-check-verification');
      const btnResend = document.getElementById('pos-btn-resend-verification');
      const btnBack = document.getElementById('pos-btn-back-signin');
      const feedback = document.getElementById('pos-verify-feedback');

      function showVerifyFeedback(msg, type = 'info') {
        if (!feedback) return;
        feedback.textContent = msg;
        feedback.className = `pos-alert ${type}`;
        feedback.style.display = 'block';
      }

      if (btnCheck) {
        btnCheck.addEventListener('click', async () => {
          btnCheck.disabled = true;
          btnCheck.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Checking verification...`;
          try {
            const result = typeof window.ParentOnboardingShell?.checkEmailVerificationSession === 'function'
              ? await window.ParentOnboardingShell.checkEmailVerificationSession({ householdName })
              : await window.ParentOnboardingShell.restoreSession();

            if (result && result.session && result.status !== 'UNAUTHENTICATED') {
              if (verifyWrap) verifyWrap.style.display = 'none';
              await renderPlansStep({ refresh: true });
            } else {
              showVerifyFeedback("We haven't detected a verified session yet. Open the verification link from your email, then return here.", 'info');
            }
          } catch (err) {
            showVerifyFeedback(err.message || 'Unable to check verification status. Please try again.', 'error');
          } finally {
            if (btnCheck) {
              btnCheck.disabled = false;
              btnCheck.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> I've verified my email`;
            }
          }
        });
      }

      let resendCooldownTimer = null;
      if (btnResend) {
        btnResend.addEventListener('click', async () => {
          btnResend.disabled = true;
          btnResend.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...`;
          try {
            if (typeof window.ParentOnboardingShell?.resendVerificationEmail === 'function') {
              await window.ParentOnboardingShell.resendVerificationEmail(email);
            }
            showVerifyFeedback(`Verification email resent to ${escapeHtml(email)}. Please check your inbox and spam folder.`, 'success');
            let cooldown = 30;
            btnResend.innerHTML = `Resend in ${cooldown}s`;
            resendCooldownTimer = setInterval(() => {
              cooldown -= 1;
              if (cooldown <= 0) {
                clearInterval(resendCooldownTimer);
                if (btnResend) {
                  btnResend.disabled = false;
                  btnResend.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Resend verification email`;
                }
              } else {
                if (btnResend) {
                  btnResend.innerHTML = `Resend in ${cooldown}s`;
                }
              }
            }, 1000);
          } catch (err) {
            showVerifyFeedback(err.message || 'Failed to resend verification email. Please try again later.', 'error');
            btnResend.disabled = false;
            btnResend.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Resend verification email`;
          }
        });
      }

      if (btnBack) {
        btnBack.addEventListener('click', () => {
          restoreAuthFormToSignIn(email);
        });
      }
    }

    function restoreAuthFormToSignIn(prefillEmail = '') {
      const verifyWrap = document.getElementById('pos-verify-wrap');
      if (verifyWrap) verifyWrap.style.display = 'none';

      const tabsWrap = stepAuth?.querySelector('.pos-tabs');
      if (tabsWrap) tabsWrap.style.display = 'flex';
      if (authForm) authForm.style.display = 'block';

      isSignUpMode = false;
      if (tabLogin) tabLogin.classList.add('active');
      if (tabSignup) tabSignup.classList.remove('active');
      if (authHouseholdWrap) authHouseholdWrap.style.display = 'none';
      if (btnAuthSubmit) btnAuthSubmit.textContent = 'Sign In to Parent Zone';
      if (prefillEmail && authEmail) {
        authEmail.value = prefillEmail;
      }
      if (authPassword) {
        authPassword.value = '';
        authPassword.focus();
      }
      clearAlert();
    }

    if (tabLogin && tabSignup) {
      tabLogin.addEventListener('click', () => {
        restoreAuthFormToSignIn(authEmail ? authEmail.value : '');
      });

      tabSignup.addEventListener('click', () => {
        const verifyWrap = document.getElementById('pos-verify-wrap');
        if (verifyWrap) verifyWrap.style.display = 'none';
        const tabsWrap = stepAuth?.querySelector('.pos-tabs');
        if (tabsWrap) tabsWrap.style.display = 'flex';
        if (authForm) authForm.style.display = 'block';

        isSignUpMode = true;
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        if (authHouseholdWrap) authHouseholdWrap.style.display = 'grid';
        if (btnAuthSubmit) btnAuthSubmit.textContent = 'Create Parent Account';
        clearAlert();
      });
    }

    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const email = authEmail.value.trim();
        const password = authPassword.value.trim();
        const householdName = authHousehold?.value?.trim() || 'Family';

        if (!email || !password) {
          showAlert('Please enter both email and password.');
          return;
        }

        try {
          if (btnAuthSubmit) {
            btnAuthSubmit.disabled = true;
            btnAuthSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${isSignUpMode ? 'Creating Account...' : 'Authenticating...'}`;
          }

          const authState = await window.ParentOnboardingShell.signInParent({
            email,
            password,
            isSignUp: isSignUpMode,
            householdName
          });

          if (authState.status === 'VERIFICATION_REQUIRED' || authState.needsVerification) {
            renderVerificationView(email, householdName);
            return;
          }

          await renderPlansStep({ refresh: !authState.synchronized });
        } catch (err) {
          showAlert(err.message || 'Authentication failed. Please check your credentials.', 'error');
        } finally {
          if (btnAuthSubmit) {
            btnAuthSubmit.disabled = false;
            btnAuthSubmit.textContent = isSignUpMode ? 'Create Parent Account' : 'Sign In to Parent Zone';
          }
        }
      });
    }

    // -------------------------------------------------------------
    // Step 2: Current Plan Summary & Subscription View
    // -------------------------------------------------------------
    async function renderPlansStep({ refresh = true } = {}) {
      setStep(2);
      if (plansContainer) {
        plansContainer.innerHTML = '<div class="pos-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading subscription details...</div>';
      }

      try {
        if (refresh) {
          await Promise.all([
            window.ParentOnboardingShell.fetchPlans(),
            window.ParentOnboardingShell.fetchCurrentSubscription(),
            window.ParentOnboardingShell.fetchUsageSummary().catch(() => null),
            window.ParentOnboardingShell.fetchChildren().catch(() => [])
          ]);
        }

        const vm = window.ParentOnboardingShell.getSubscriptionViewModel();
        if (!plansContainer) return;
        plansContainer.innerHTML = '';

        const cleanPlanName = (vm.planName || 'APPU Free').replace(/\s+Plan$/i, '').trim();

        if (vm.isPaidAccess) {
          // ACTIVE PLAN FULL-WIDTH DASHBOARD SUMMARY
          const currentPlanCard = document.createElement('div');
          currentPlanCard.className = 'pos-current-plan-dashboard';

          const pctAiUsed = Math.min(100, Math.round((vm.aiSessions.used / (vm.aiSessions.limit || 1)) * 100));
          const pctVoiceUsed = vm.voiceMinutes.used !== null
            ? Math.min(100, Math.round((vm.voiceMinutes.used / (vm.voiceMinutes.limit || 1)) * 100))
            : 0;

          const voiceStatusPill = vm.voiceMinutes.meteringStatus === 'active'
            ? `<span class="pos-pill-sm" style="background:rgba(34,197,94,.15);color:#22c55e;margin-left:4px;">Active</span>`
            : `<span class="pos-pill-sm" style="background:rgba(148,163,184,.15);color:#94a3b8;margin-left:4px;">Metering pending</span>`;

          const voiceMetricBox = `
            <div class="pos-dashboard-metric-box">
              <div class="pos-metric-header">
                <div class="pos-metric-title">
                  <i class="fa-solid fa-microphone text-cyan"></i>
                  <span>Voice Minutes (Monthly)</span>
                  ${voiceStatusPill}
                </div>
                <strong class="pos-metric-count">${vm.voiceMinutes.used !== null ? vm.voiceMinutes.used : 0} / ${vm.voiceMinutes.limit} min</strong>
              </div>
              <div class="pos-meter-track">
                <div class="pos-meter-fill" style="width: ${pctVoiceUsed}%;"></div>
              </div>
              <div class="pos-metric-sub">
                <span>${vm.voiceMinutes.remaining !== null ? vm.voiceMinutes.remaining : vm.voiceMinutes.limit} min remaining</span>
                <span>${pctVoiceUsed}% used</span>
              </div>
            </div>
          `;

          currentPlanCard.innerHTML = `
            <div class="pos-dashboard-header">
              <div class="pos-dashboard-plan-meta">
                <span class="pos-kicker">YOUR CURRENT SUBSCRIPTION</span>
                <div class="pos-dashboard-title-row">
                  <h3>${cleanPlanName}</h3>
                  <div class="pos-dashboard-price-pill">${vm.displayPrice} <span>/ ${vm.billingInterval || 'month'}</span></div>
                </div>
                <p class="pos-dashboard-msg">${vm.statusMessage}</p>
              </div>
              <div class="pos-status-pill active"><i class="fa-solid fa-circle-check"></i> ACTIVE</div>
            </div>

            <div class="pos-dashboard-metrics-grid">
              <div class="pos-dashboard-metric-box">
                <div class="pos-metric-header">
                  <div class="pos-metric-title">
                    <i class="fa-solid fa-bolt text-cyan"></i>
                    <span>AI Sessions (Monthly)</span>
                  </div>
                  <strong class="pos-metric-count">${vm.aiSessions.used} / ${vm.aiSessions.limit}</strong>
                </div>
                <div class="pos-meter-track">
                  <div class="pos-meter-fill" style="width: ${pctAiUsed}%;"></div>
                </div>
                <div class="pos-metric-sub">
                  <span>${vm.aiSessions.remaining} remaining</span>
                  <span>${pctAiUsed}% used</span>
                </div>
              </div>

              ${voiceMetricBox}
            </div>

            <div class="pos-dashboard-actions">
              <button id="pos-btn-continue-plan" class="primary-modal-btn" type="button">
                <span>Continue with ${cleanPlanName}</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
              <button id="pos-btn-toggle-plans" class="pos-secondary-btn" type="button">
                <i class="fa-solid fa-table-columns"></i> View / Compare Plans
              </button>
            </div>

            <div id="pos-compare-grid-wrap" style="display: none; margin-top: 20px; width: 100%;">
              <p class="pos-subtitle">All Learning Companion Plans:</p>
              <div id="pos-compare-section-container"></div>
            </div>
          `;

          plansContainer.appendChild(currentPlanCard);

          const btnContinue = currentPlanCard.querySelector('#pos-btn-continue-plan');
          if (btnContinue) {
            btnContinue.addEventListener('click', () => renderChildStep());
          }

          const btnToggle = currentPlanCard.querySelector('#pos-btn-toggle-plans');
          const compareWrap = currentPlanCard.querySelector('#pos-compare-grid-wrap');
          const compareContainer = currentPlanCard.querySelector('#pos-compare-section-container');

          if (btnToggle && compareWrap && compareContainer) {
            btnToggle.addEventListener('click', () => {
              const isHidden = compareWrap.style.display === 'none';
              compareWrap.style.display = isHidden ? 'block' : 'none';
              btnToggle.innerHTML = isHidden
                ? '<i class="fa-solid fa-chevron-up"></i> Hide Plan Comparison'
                : '<i class="fa-solid fa-table-columns"></i> View / Compare Plans';

              if (isHidden && compareContainer.children.length === 0) {
                renderPricingSection(compareContainer, {
                  currentPlanCode: vm.planCode,
                  defaultInterval: vm.planCode?.includes('monthly') ? 'monthly' : 'yearly',
                  onPlanActivated: renderPlansStep
                });
              }
            });
          }

        } else if (vm.hasSubscription && !vm.isPaidAccess) {
          // NON-ACTIVE SUBSCRIPTION STATUS CARD
          const subNotice = document.createElement('div');
          subNotice.className = 'pos-current-plan-dashboard';
          subNotice.innerHTML = `
            <div class="pos-dashboard-header">
              <div class="pos-dashboard-plan-meta">
                <span class="pos-kicker">SUBSCRIPTION STATUS</span>
                <div class="pos-dashboard-title-row">
                  <h3>${cleanPlanName}</h3>
                </div>
                <p class="pos-dashboard-msg">${vm.statusMessage}</p>
              </div>
              <div class="pos-status-pill ${vm.statusBadgeClass}">${vm.statusLabel}</div>
            </div>
            <div class="pos-dashboard-actions" style="margin-top: 10px;">
              <button id="pos-btn-activate-plan" class="primary-modal-btn" type="button">
                <span>Select Plan to Activate</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
            <div id="pos-plans-select-grid-wrap" style="display:none; margin-top: 20px; width: 100%;">
              <div id="pos-plans-select-grid"></div>
            </div>
          `;

          plansContainer.appendChild(subNotice);

          const btnAct = subNotice.querySelector('#pos-btn-activate-plan');
          const gridWrap = subNotice.querySelector('#pos-plans-select-grid-wrap');
          const gridContainer = subNotice.querySelector('#pos-plans-select-grid');
          if (btnAct && gridWrap && gridContainer) {
            btnAct.addEventListener('click', () => {
              gridWrap.style.display = 'block';
              btnAct.style.display = 'none';
              renderPricingSection(gridContainer, {
                currentPlanCode: null,
                defaultInterval: 'yearly',
                onPlanActivated: renderChildStep
              });
            });
          }

        } else {
          // NO SUBSCRIPTION: RENDER SELECTION VIEW WITH PROMINENT ANNUAL TOGGLE
          const gridTitle = document.createElement('p');
          gridTitle.className = 'pos-subtitle';
          gridTitle.textContent = 'Choose an APPU AI Learning Companion Plan:';
          plansContainer.appendChild(gridTitle);

          const pricingContainer = document.createElement('div');
          pricingContainer.className = 'pos-pricing-root';
          plansContainer.appendChild(pricingContainer);

          renderPricingSection(pricingContainer, {
            currentPlanCode: null,
            defaultInterval: 'yearly',
            onPlanActivated: renderChildStep
          });
        }

      } catch (err) {
        showAlert(err.message || 'Failed to load plans');
      }
    }

    /**
     * Renders prominent Monthly / Annual toggle and exactly 4 tier-grouped cards
     * with outcome-focused content, annual savings, and Genesis contextual upsell.
     */
    function renderPricingSection(container, options = {}) {
      const currentPlanCode = options.currentPlanCode || null;
      let currentInterval = options.defaultInterval || (currentPlanCode?.includes('monthly') ? 'monthly' : 'yearly');
      const onPlanActivated = options.onPlanActivated || renderChildStep;

      container.innerHTML = '';

      // 1. Prominent Frequency Toggle
      const toggleWrap = document.createElement('div');
      toggleWrap.className = 'pos-billing-toggle-wrap';
      toggleWrap.innerHTML = `
        <div class="pos-billing-toggle" role="radiogroup" aria-label="Billing frequency">
          <button type="button" class="pos-billing-btn ${currentInterval === 'yearly' ? 'active' : ''}" data-interval="yearly">
            Annual <span class="pos-billing-save-badge">Save up to 17%</span>
          </button>
          <button type="button" class="pos-billing-btn ${currentInterval === 'monthly' ? 'active' : ''}" data-interval="monthly">
            Monthly
          </button>
        </div>
        <div class="pos-billing-caption">
          <i class="fa-solid fa-sparkles text-cyan"></i>
          <span>Pay annually. Save more. Grow longer. (Recommended)</span>
        </div>
      `;
      container.appendChild(toggleWrap);

      // 2. Primary 4-Cards Grid
      const grid = document.createElement('div');
      grid.className = 'pos-plans-grid';
      container.appendChild(grid);

      // 3. Genesis Contextual Upsell Strip (Below Primary Grid)
      const upsellWrap = document.createElement('div');
      upsellWrap.className = 'pos-genesis-upsell';
      upsellWrap.innerHTML = `
        <div class="pos-genesis-text">
          <i class="fa-solid fa-sparkles text-cyan" style="margin-right: 6px;"></i>
          <span>Need deeper personalisation and continuous Learning DNA coaching?</span>
        </div>
        <button type="button" class="pos-link-btn pos-btn-toggle-genesis">
          Explore APPU Genesis →
        </button>
      `;
      container.appendChild(upsellWrap);

      const genesisDetail = document.createElement('div');
      genesisDetail.className = 'pos-genesis-detail-box';
      genesisDetail.style.display = 'none';
      container.appendChild(genesisDetail);

      const btnToggleGenesis = upsellWrap.querySelector('.pos-btn-toggle-genesis');
      if (btnToggleGenesis) {
        btnToggleGenesis.addEventListener('click', () => {
          const isHidden = genesisDetail.style.display === 'none';
          genesisDetail.style.display = isHidden ? 'block' : 'none';
          btnToggleGenesis.textContent = isHidden
            ? 'Hide APPU Genesis Details'
            : 'Explore APPU Genesis →';
          if (isHidden) {
            renderGenesisDetailCard(genesisDetail, currentInterval, currentPlanCode);
          }
        });
      }

      function renderGenesisDetailCard(box, interval, activeCode) {
        const allTiers = (window.ParentOnboardingShell.groupPlansByTier && window.ParentOnboardingShell.groupPlansByTier()) || [];
        const genesisTier = allTiers.find((t) => t.tierCode === 'genesis') || {
          tierCode: 'genesis',
          tierName: 'APPU Genesis',
          description: 'Complete multimodal cognitive architecture with bespoke learning DNA and continuous coaching.',
          monthly: { code: 'genesis_monthly', amountPaise: 249900 },
          annual: { code: 'genesis_annual', amountPaise: 2499900 }
        };

        const genesisPlan = interval === 'yearly' ? genesisTier.annual : genesisTier.monthly;
        const targetCode = genesisPlan?.code || (interval === 'yearly' ? 'genesis_annual' : 'genesis_monthly');
        const isCurrent = activeCode === targetCode;
        const priceText = interval === 'yearly' ? '₹24,999/year' : '₹2,499/month';
        const equivText = interval === 'yearly' ? '₹2,083/mo billed annually • Save ₹4,989/yr' : 'Billed monthly';

        box.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <span class="pos-kicker" style="color:#c084fc;">SPECIALIZED COGNITIVE ARCHITECTURE</span>
              <h4 style="margin:2px 0 0; color:#fff; font-size:16px;">APPU Genesis Tier</h4>
            </div>
            <span class="pos-badge bespoke">COGNITIVE DNA</span>
          </div>
          <div class="pos-price" style="font-size:18px; color:#c084fc; margin-bottom:2px;">${priceText}</div>
          <div class="pos-equiv-sub" style="margin-bottom:8px;">${equivText}</div>
          <div class="pos-plan-quota-badge" style="border-color:rgba(192,132,252,.3); background:rgba(192,132,252,.08); color:#e9d5ff; margin-bottom:10px;">
            <i class="fa-solid fa-bolt"></i> 1,000 AI sessions • 300 voice mins / mo
          </div>
          <p style="margin:0 0 10px; font-size:12px; color:#cbd5e1;">${genesisTier.description}</p>
          <ul class="pos-features" style="margin-bottom:12px;">
            <li><i class="fa-solid fa-check text-cyan"></i> Complete multimodal cognitive memory & learning DNA</li>
            <li><i class="fa-solid fa-check text-cyan"></i> Continuous 1-on-1 mentor guidance & goal mastery</li>
            <li><i class="fa-solid fa-check text-cyan"></i> Bespoke learning blueprints & priority advisory</li>
          </ul>
          ${
            isCurrent
              ? `<button class="pos-plan-btn current" type="button" disabled>Current Active Plan</button>`
              : `<button class="pos-plan-btn bespoke pos-btn-select-genesis" type="button" data-code="${targetCode}">Get Genesis (${priceText})</button>`
          }
        `;

        const btnGenesis = box.querySelector('.pos-btn-select-genesis');
        if (btnGenesis) {
          btnGenesis.addEventListener('click', async () => {
            try {
              btnGenesis.disabled = true;
              btnGenesis.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Starting Checkout...';
              await window.ParentOnboardingShell.subscribeToPlan(targetCode, (status) => {
                if (planStatusText) planStatusText.textContent = status;
              });
              await onPlanActivated();
            } catch (err) {
              showAlert(err.message || 'Subscription failed');
            } finally {
              btnGenesis.disabled = false;
              btnGenesis.textContent = `Get Genesis (${priceText})`;
              if (planStatusText) planStatusText.textContent = '';
            }
          });
        }
      }

      function renderCards() {
        grid.innerHTML = '';
        const allTiers = (window.ParentOnboardingShell.groupPlansByTier && window.ParentOnboardingShell.groupPlansByTier()) || [];
        const primaryTiers = allTiers.filter((t) => t.isPrimaryCard);

        primaryTiers.forEach((tier) => {
          const card = document.createElement('div');
          const isFree = tier.tierCode === 'free';
          const isSignature = tier.tierCode === 'signature';
          const isEvolvePlus = tier.tierCode === 'evolve_plus';

          const plan = isFree
            ? (tier.monthly || tier.annual)
            : isSignature
            ? ((currentInterval === 'yearly' ? tier.annual : tier.monthly) || tier.monthly || tier.annual)
            : (currentInterval === 'yearly' ? tier.annual : tier.monthly);

          const targetPlanCode = plan?.code || (isFree ? 'free' : isSignature ? 'signature' : `${tier.tierCode}_${currentInterval === 'yearly' ? 'annual' : 'monthly'}`);
          const isCurrent = currentPlanCode === targetPlanCode || (isFree && currentPlanCode === 'free');

          card.className = `pos-plan-card ${isEvolvePlus ? 'featured' : ''} ${isCurrent ? 'current' : ''}`;
          card.setAttribute('data-tier', tier.tierCode);

          // Badges
          let badgeHtml = '';
          if (isCurrent) {
            badgeHtml = '<span class="pos-badge current">CURRENT PLAN</span>';
          } else if (isEvolvePlus) {
            badgeHtml = '<span class="pos-badge">MOST POPULAR</span>';
          } else if (isSignature) {
            badgeHtml = '<span class="pos-badge bespoke">BESPOKE</span>';
          }

          // Pricing & Subtitles
          let priceHtml = '';
          let subHtml = '';

          if (isFree) {
            priceHtml = '<div class="pos-price">₹0 <span>Forever</span></div>';
            subHtml = '<div class="pos-equiv-sub"><span class="pos-save-tag">No credit card required</span></div>';
          } else if (isSignature) {
            const sigPrice = currentInterval === 'yearly' ? 'From ₹49,999' : 'From ₹4,999';
            const sigUnit = currentInterval === 'yearly' ? 'year' : 'month';
            priceHtml = `<div class="pos-price">${sigPrice} <span>/${sigUnit}</span></div>`;
            subHtml = '<div class="pos-equiv-sub">Custom institutional architecture</div>';
          } else {
            const amountPaise = plan?.amountPaise ?? (tier.tierCode === 'evolve' ? (currentInterval === 'yearly' ? 499900 : 49900) : (currentInterval === 'yearly' ? 999900 : 99900));
            const priceNum = Math.round(amountPaise / 100);

            if (currentInterval === 'yearly') {
              const equivMo = Math.round((plan?.monthlyEquivalentPaise || (tier.tierCode === 'evolve' ? 41700 : 83300)) / 100);
              const savings = Math.round((plan?.annualSavingsPaise || (tier.tierCode === 'evolve' ? 98900 : 198900)) / 100);
              const pct = tier.tierCode === 'evolve' ? '~16%' : '~17%';
              priceHtml = `<div class="pos-price">₹${priceNum.toLocaleString('en-IN')} <span>/year</span></div>`;
              subHtml = `<div class="pos-equiv-sub">₹${equivMo}/mo billed annually • <span class="pos-save-tag">Save ₹${savings.toLocaleString('en-IN')}/yr (${pct})</span></div>`;
            } else {
              priceHtml = `<div class="pos-price">₹${priceNum.toLocaleString('en-IN')} <span>/month</span></div>`;
              subHtml = '<div class="pos-equiv-sub">Billed monthly</div>';
            }
          }

          // Quota Badges
          let quotaBadge = '';
          if (isFree) {
            quotaBadge = '<div class="pos-plan-quota-badge"><i class="fa-solid fa-bolt"></i> 20 AI sessions • 5 voice mins / mo</div>';
          } else if (tier.tierCode === 'evolve') {
            quotaBadge = '<div class="pos-plan-quota-badge"><i class="fa-solid fa-bolt"></i> 150 AI sessions • 45 voice mins / mo</div>';
          } else if (isEvolvePlus) {
            quotaBadge = '<div class="pos-plan-quota-badge"><i class="fa-solid fa-bolt"></i> 400 AI sessions • 120 voice mins / mo</div>';
          } else if (isSignature) {
            quotaBadge = '<div class="pos-plan-quota-badge"><i class="fa-solid fa-bolt"></i> Custom capacity & priority SLA</div>';
          }

          // Feature bullet points (Outcome focused per HR guidelines - No learner counts)
          let featuresHtml = '';
          if (isFree) {
            featuresHtml = `
              <li><i class="fa-solid fa-check text-cyan"></i> Basic AI learning companion</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Essential subject practice & discovery</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Interactive learning questions</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Standard safety & privacy guardrails</li>
            `;
          } else if (tier.tierCode === 'evolve') {
            featuresHtml = `
              <li><i class="fa-solid fa-check text-cyan"></i> APPU remembers how you learn</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Your learning path adapts</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Learn through stories and challenges</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Weekly missions and personalised quizzes</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Multilingual learning companion</li>
            `;
          } else if (isEvolvePlus) {
            featuresHtml = `
              <li><i class="fa-solid fa-check text-cyan"></i> Everything adapts more deeply to you</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Strength and learning-gap discovery</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Advanced missions and project learning</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Goal journeys and career exploration</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Parent insights and progress intelligence</li>
            `;
          } else if (isSignature) {
            featuresHtml = `
              <li><i class="fa-solid fa-check text-cyan"></i> Custom AI & voice session allocation</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Tailored curriculum & institutional blueprints</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Dedicated learning architect & priority SLA</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Custom reporting & parent advisory</li>
            `;
          }

          // Action Button
          let btnHtml = '';
          if (isCurrent) {
            btnHtml = `<button class="pos-plan-btn current" type="button" disabled>Current Active Plan</button>`;
          } else if (isSignature) {
            btnHtml = `<button class="pos-plan-btn bespoke pos-btn-select-plan" type="button" data-action="signature">Apply for Signature</button>`;
          } else if (isFree) {
            btnHtml = `<button class="pos-plan-btn pos-btn-select-plan" type="button" data-code="free">Start Free</button>`;
          } else {
            const btnText = currentPlanCode ? `Switch to ${tier.tierName}` : `Choose ${tier.tierName}`;
            btnHtml = `<button class="pos-plan-btn pos-btn-select-plan" type="button" data-code="${targetPlanCode}">${btnText}</button>`;
          }

          card.innerHTML = `
            ${badgeHtml}
            <h3>${tier.tierName}</h3>
            ${priceHtml}
            ${subHtml}
            ${quotaBadge}
            <p class="pos-plan-desc">${tier.description}</p>
            <ul class="pos-features">
              ${featuresHtml}
            </ul>
            ${btnHtml}
          `;

          const btnSelect = card.querySelector('.pos-btn-select-plan');
          if (btnSelect) {
            btnSelect.addEventListener('click', async () => {
              if (btnSelect.dataset.action === 'signature') {
                showAlert('Signature is our bespoke institutional solution. Please reach out to our team at support@appu.ai or schedule an advisory session.', 'success');
                return;
              }

              const selectedCode = btnSelect.dataset.code;
              if (!selectedCode) return;

              try {
                btnSelect.disabled = true;
                btnSelect.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${selectedCode === 'free' ? 'Activating Free Plan...' : 'Starting Checkout...'}`;
                await window.ParentOnboardingShell.subscribeToPlan(selectedCode, (status) => {
                  if (planStatusText) planStatusText.textContent = status;
                });
                await onPlanActivated();
              } catch (err) {
                showAlert(err.message || 'Subscription selection failed');
              } finally {
                btnSelect.disabled = false;
                btnSelect.textContent = isFree ? 'Start Free' : (currentPlanCode ? `Switch to ${tier.tierName}` : `Choose ${tier.tierName}`);
                if (planStatusText) planStatusText.textContent = '';
              }
            });
          }

          grid.appendChild(card);
        });

        if (genesisDetail.style.display === 'block') {
          renderGenesisDetailCard(genesisDetail, currentInterval, currentPlanCode);
        }
      }

      // Toggle click handlers
      toggleWrap.querySelectorAll('.pos-billing-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const newInterval = btn.dataset.interval;
          if (!newInterval || newInterval === currentInterval) return;
          currentInterval = newInterval;
          toggleWrap.querySelectorAll('.pos-billing-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.interval === currentInterval);
          });
          renderCards();
        });
      });

      renderCards();
    }

    // -------------------------------------------------------------
    // Step 3: Learner Setup & Quota-Aware Form Step
    // -------------------------------------------------------------
    async function renderChildStep() {
      setStep(3);
      if (childListContainer) {
        childListContainer.innerHTML = '<div class="pos-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading learners...</div>';
      }

      try {
        await window.ParentOnboardingShell.fetchChildren();
        const vm = window.ParentOnboardingShell.getSubscriptionViewModel();

        if (!childListContainer) return;
        childListContainer.innerHTML = '';

        // Compact Subscription Header
        const summaryBar = document.createElement('div');
        summaryBar.className = 'pos-compact-plan-bar';
        summaryBar.innerHTML = `
          <div>
            <span class="pos-pill-sm ${vm.statusBadgeClass}">${vm.statusLabel}</span>
            <strong>${vm.planName}</strong>
          </div>
          <span style="font-size: 11px; color: var(--muted);">${vm.displayPrice}</span>
        `;
        childListContainer.appendChild(summaryBar);

        if (vm.children.length > 0) {
          const listTitle = document.createElement('h4');
          listTitle.className = 'pos-subtitle';
          listTitle.textContent = 'Learner Profile:';
          childListContainer.appendChild(listTitle);

          vm.children.forEach((c) => {
            const item = document.createElement('div');
            item.className = 'pos-child-card';
            item.innerHTML = `
              <div class="pos-child-info">
                <i class="fa-solid fa-child-reaching text-cyan"></i>
                <div>
                  <strong>${c.preferredName}</strong>
                  <span>${c.gradeBand}</span>
                </div>
              </div>
              <div style="display:flex; gap: 6px;">
                <button class="pos-secondary-btn pos-btn-edit-pers" style="min-height: 32px; padding: 0 10px; font-size: 11px;" type="button" title="Edit Personalisation">
                  <i class="fa-solid fa-sliders"></i>
                </button>
                <button class="pos-child-select-btn" type="button">Select <i class="fa-solid fa-arrow-right"></i></button>
              </div>
            `;

            const btnSelect = item.querySelector('.pos-child-select-btn');
            btnSelect.addEventListener('click', () => {
              window.ParentOnboardingShell.state.selectedChild = c;
              renderPersonalisationStep(c);
            });

            const btnEdit = item.querySelector('.pos-btn-edit-pers');
            if (btnEdit) {
              btnEdit.addEventListener('click', () => {
                window.ParentOnboardingShell.state.selectedChild = c;
                renderPersonalisationStep(c);
              });
            }

            childListContainer.appendChild(item);
          });
        }

        // Learner Quota Limit UX
        if (!vm.canAddLearner) {
          // Quota reached: hide child form and show informative profile active prompt
          if (childNewFormWrap) childNewFormWrap.style.display = 'none';

          const quotaNotice = document.createElement('div');
          quotaNotice.className = 'pos-quota-box';
          quotaNotice.innerHTML = `
            <i class="fa-solid fa-circle-check text-cyan"></i>
            <div>
              <strong>Learner profile active</strong>
              <p>Your student companion is configured for this learner profile.</p>
              <button id="pos-btn-view-upgrade-from-quota" class="pos-link-btn" type="button">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Manage Subscription Plans
              </button>
            </div>
          `;
          childListContainer.appendChild(quotaNotice);

          const btnUp = quotaNotice.querySelector('#pos-btn-view-upgrade-from-quota');
          if (btnUp) {
            btnUp.addEventListener('click', () => renderPlansStep());
          }
        } else {
          // Quota allows adding more learners
          if (childNewFormWrap) childNewFormWrap.style.display = 'block';
        }

      } catch (err) {
        showAlert(err.message || 'Failed to load learners');
      }
    }

    if (childNewForm) {
      childNewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const preferredName = childNameInput.value.trim();
        const gradeBand = childGradeSelect.value;

        if (!preferredName || !gradeBand) {
          showAlert('Please enter learner name and class.');
          return;
        }

        try {
          const child = await window.ParentOnboardingShell.createChild({ preferredName, gradeBand });
          childNameInput.value = '';
          renderPersonalisationStep(child);
        } catch (err) {
          showAlert(err.message || 'Failed to add learner profile.');
        }
      });
    }

    // -------------------------------------------------------------
    // Step 4: Personalisation Questionnaire Step
    // -------------------------------------------------------------
    async function renderPersonalisationStep(child) {
      setStep(4);
      const title = document.getElementById('pos-pers-child-name');
      if (title) title.textContent = child.preferredName;

      try {
        const pers = await window.ParentOnboardingShell.fetchPersonalisation(child.id);
        if (pers) {
          if (persLang) persLang.value = pers.preferredLanguage || 'en';
          if (persStyle) persStyle.value = pers.learningStyle || 'interactive';
          if (persFont) persFont.value = pers.fontPreference || 'rounded';
          if (persResponse) persResponse.value = pers.responseStyle || 'playful';
          if (persTheme) persTheme.value = pers.themePreference || 'auto';
          if (persInterests) persInterests.value = (pers.interests || []).join(', ');
          if (persSubjects) persSubjects.value = (pers.favoriteSubjects || []).join(', ');
          if (persGoals) persGoals.value = (pers.goals || []).join(', ');
        }
      } catch {
        // Safe default fallback
      }
    }

    if (persForm) {
      persForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const child = window.ParentOnboardingShell.state.selectedChild;
        if (!child) {
          showAlert('No child selected');
          return;
        }

        const parseList = (str) =>
          str
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && s.length < 50);

        const personalisationData = {
          preferredLanguage: persLang?.value || 'en',
          learningStyle: persStyle?.value || 'interactive',
          fontPreference: persFont?.value || 'rounded',
          responseStyle: persResponse?.value || 'playful',
          themePreference: persTheme?.value || 'auto',
          favoriteColor: '#1f6feb',
          interests: parseList(persInterests?.value || 'science, space'),
          favoriteSubjects: parseList(persSubjects?.value || 'Science, Mathematics'),
          goals: parseList(persGoals?.value || 'Learn conceptually and have fun')
        };

        try {
          await window.ParentOnboardingShell.savePersonalisation(child.id, personalisationData);
          setStep(5);
        } catch (err) {
          showAlert(err.message || 'Failed to save personalisation.');
        }
      });
    }

    // -------------------------------------------------------------
    // Step 5: Launch Appu Session Handoff
    // -------------------------------------------------------------
    if (btnLaunchAppu) {
      btnLaunchAppu.addEventListener('click', () => {
        const child = window.ParentOnboardingShell.state.selectedChild;
        window.ParentOnboardingShell.launchAppuSession(child);
        closeModal();

        // Trigger welcome voice greeting in Appu
        if (typeof window.app !== 'undefined' && typeof window.app.handleUserInteraction === 'function') {
          const lang = persLang?.value || 'en';
          if (lang === 'kn') {
            window.app.handleUserInteraction(`ನಮಸ್ಕಾರ ${child.preferredName}! ನಾನು ಅಪ್ಪು, ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಕಲಿಕೆಯ ಸ್ನೇಹಿತ. ಇಂದು ನಾವು ಏನು ಕಲಿಯೋಣ?`);
          } else {
            window.app.handleUserInteraction(`Hi ${child.preferredName}! I'm Appu, your personal AI learning companion. What would you like to explore today?`);
          }
        }
      });
    }

    activeOpenModal = openModal;
    activeCloseModal = closeModal;
  }

  let activeOpenModal = null;
  let activeCloseModal = null;

  return {
    init,
    openModal: (step) => { if (activeOpenModal) activeOpenModal(step); },
    closeModal: () => { if (activeCloseModal) activeCloseModal(); }
  };
});
