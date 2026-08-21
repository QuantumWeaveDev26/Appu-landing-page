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

    function openModal() {
      modal.classList.add('is-visible');
      clearAlert();

      // Check if session already exists
      const isAuthed =
        typeof window !== 'undefined' &&
        window.ParentOnboardingShell &&
        window.ParentOnboardingShell.state.session;

      if (isAuthed) {
        renderPlansStep();
      } else {
        setStep(1);
      }
    }

    function closeModal() {
      modal.classList.remove('is-visible');
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

    // -------------------------------------------------------------
    // Step 1: Auth Tabs & Form
    // -------------------------------------------------------------
    if (tabLogin && tabSignup) {
      tabLogin.addEventListener('click', () => {
        isSignUpMode = false;
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        if (authHouseholdWrap) authHouseholdWrap.style.display = 'none';
        if (btnAuthSubmit) btnAuthSubmit.textContent = 'Sign In to Parent Zone';
        clearAlert();
      });

      tabSignup.addEventListener('click', () => {
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
            btnAuthSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...`;
          }

          await window.ParentOnboardingShell.signInParent({
            email,
            password,
            isSignUp: isSignUpMode,
            householdName
          });

          await renderPlansStep();
        } catch (err) {
          showAlert(err.message || 'Authentication failed. Please check your credentials.');
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
    async function renderPlansStep() {
      setStep(2);
      if (plansContainer) {
        plansContainer.innerHTML = '<div class="pos-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading subscription details...</div>';
      }

      try {
        await Promise.all([
          window.ParentOnboardingShell.fetchPlans(),
          window.ParentOnboardingShell.fetchCurrentSubscription(),
          window.ParentOnboardingShell.fetchChildren().catch(() => [])
        ]);

        const vm = window.ParentOnboardingShell.getSubscriptionViewModel();
        if (!plansContainer) return;
        plansContainer.innerHTML = '';

        if (vm.isPaidAccess) {
          // ACTIVE PLAN SUMMARY CARD
          const currentPlanCard = document.createElement('div');
          currentPlanCard.className = 'pos-current-plan-card';

          const pctUsed = Math.min(100, Math.round((vm.childCount / vm.maxChildren) * 100));

          currentPlanCard.innerHTML = `
            <div class="pos-current-plan-header">
              <div>
                <span class="pos-kicker">YOUR CURRENT PLAN</span>
                <h3>${vm.planName} Plan</h3>
              </div>
              <div class="pos-status-pill active"><i class="fa-solid fa-circle-check"></i> ACTIVE</div>
            </div>
            <div class="pos-price-tag">${vm.displayPrice} <span>/ month</span></div>
            <p class="pos-status-msg">${vm.statusMessage}</p>

            <div class="pos-plan-features-box">
              <strong>Included with your plan:</strong>
              <ul class="pos-features-list">
                <li><i class="fa-solid fa-check text-cyan"></i> Up to <strong>${vm.maxChildren} learner slot${vm.maxChildren > 1 ? 's' : ''}</strong></li>
                <li><i class="fa-solid fa-check text-cyan"></i> <strong>${vm.entitlements.monthlyAiSessions} AI sessions</strong> / month included</li>
                <li><i class="fa-solid fa-check text-cyan"></i> <strong>${vm.entitlements.monthlyVoiceMinutes} voice minutes</strong> / month included</li>
                <li><i class="fa-solid fa-check text-cyan"></i> Multilingual learning companion</li>
              </ul>
            </div>

            <div class="pos-usage-meter-box">
              <div class="pos-usage-meter-label">
                <span>Learner slots</span>
                <strong>${vm.childCount} of ${vm.maxChildren} used</strong>
              </div>
              <div class="pos-meter-track">
                <div class="pos-meter-fill" style="width: ${pctUsed}%;"></div>
              </div>
            </div>

            <div class="pos-card-actions">
              <button id="pos-btn-continue-plan" class="primary-modal-btn" type="button">
                <span>Continue with ${vm.planName}</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
              <button id="pos-btn-toggle-plans" class="pos-secondary-btn" type="button">
                <i class="fa-solid fa-table-columns"></i> View / Compare All Plans
              </button>
            </div>

            <div id="pos-compare-grid-wrap" style="display: none; margin-top: 15px;">
              <p class="pos-subtitle">All Learning Companion Plans:</p>
              <div class="pos-plans-grid" id="pos-compare-grid"></div>
            </div>
          `;

          plansContainer.appendChild(currentPlanCard);

          const btnContinue = currentPlanCard.querySelector('#pos-btn-continue-plan');
          if (btnContinue) {
            btnContinue.addEventListener('click', () => renderChildStep());
          }

          const btnToggle = currentPlanCard.querySelector('#pos-btn-toggle-plans');
          const compareWrap = currentPlanCard.querySelector('#pos-compare-grid-wrap');
          const compareGrid = currentPlanCard.querySelector('#pos-compare-grid');

          if (btnToggle && compareWrap && compareGrid) {
            btnToggle.addEventListener('click', () => {
              const isHidden = compareWrap.style.display === 'none';
              compareWrap.style.display = isHidden ? 'block' : 'none';
              btnToggle.innerHTML = isHidden
                ? '<i class="fa-solid fa-chevron-up"></i> Hide Plan Comparison'
                : '<i class="fa-solid fa-table-columns"></i> View / Compare All Plans';

              if (isHidden && compareGrid.children.length === 0) {
                renderComparisonCards(compareGrid, vm.planCode);
              }
            });
          }

        } else if (vm.hasSubscription && !vm.isPaidAccess) {
          // NON-ACTIVE SUBSCRIPTION STATUS CARD
          const subNotice = document.createElement('div');
          subNotice.className = 'pos-current-plan-card';
          subNotice.innerHTML = `
            <div class="pos-current-plan-header">
              <div>
                <span class="pos-kicker">SUBSCRIPTION STATUS</span>
                <h3>${vm.planName}</h3>
              </div>
              <div class="pos-status-pill ${vm.statusBadgeClass}">${vm.statusLabel}</div>
            </div>
            <p class="pos-status-msg">${vm.statusMessage}</p>
            <div class="pos-card-actions">
              <button id="pos-btn-activate-plan" class="primary-modal-btn" type="button">
                <span>Select Plan to Activate</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
            <div id="pos-plans-select-grid" class="pos-plans-grid" style="display:none; margin-top: 15px;"></div>
          `;

          plansContainer.appendChild(subNotice);

          const btnAct = subNotice.querySelector('#pos-btn-activate-plan');
          const grid = subNotice.querySelector('#pos-plans-select-grid');
          if (btnAct && grid) {
            btnAct.addEventListener('click', () => {
              grid.style.display = 'grid';
              btnAct.style.display = 'none';
              renderPlansGrid(grid);
            });
          }

        } else {
          // NO SUBSCRIPTION: RENDER SELECTION GRID
          const gridTitle = document.createElement('p');
          gridTitle.className = 'pos-subtitle';
          gridTitle.textContent = 'Choose an AI Learning Companion Plan:';
          plansContainer.appendChild(gridTitle);

          const grid = document.createElement('div');
          grid.className = 'pos-plans-grid';
          plansContainer.appendChild(grid);
          renderPlansGrid(grid);
        }

      } catch (err) {
        showAlert(err.message || 'Failed to load plans');
      }
    }

    /**
     * Renders plan purchase cards for unpaid or new subscriptions.
     */
    function renderPlansGrid(container) {
      const plans = window.ParentOnboardingShell.state.plans || [];
      container.innerHTML = '';

      plans.forEach((p) => {
        const card = document.createElement('div');
        card.className = `pos-plan-card ${p.code === 'growth' ? 'featured' : ''}`;
        const priceRupees = Math.round(p.amountPaise / 100);
        const maxChildren = p.entitlements?.max_children ?? 1;

        card.innerHTML = `
          ${p.code === 'growth' ? '<span class="pos-badge">Most Popular</span>' : ''}
          <h3>${p.name}</h3>
          <div class="pos-price">₹${priceRupees}<span>/month</span></div>
          <p class="pos-plan-desc">${p.description || ''}</p>
          <ul class="pos-features">
            <li><i class="fa-solid fa-check text-cyan"></i> Up to <strong>${maxChildren} learner${maxChildren > 1 ? 's' : ''}</strong></li>
            <li><i class="fa-solid fa-check text-cyan"></i> <strong>${p.entitlements?.monthly_ai_sessions || 100} AI sessions</strong> / month</li>
            <li><i class="fa-solid fa-check text-cyan"></i> <strong>${p.entitlements?.monthly_voice_minutes || 30} voice mins</strong> / month</li>
            <li><i class="fa-solid fa-check text-cyan"></i> Multilingual explanations</li>
          </ul>
          <button class="pos-plan-btn" data-code="${p.code}" type="button">Select ${p.name}</button>
        `;

        const btnSelect = card.querySelector('.pos-plan-btn');
        btnSelect.addEventListener('click', async () => {
          try {
            btnSelect.disabled = true;
            btnSelect.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Starting Checkout...`;
            await window.ParentOnboardingShell.subscribeToPlan(p.code, (status) => {
              if (planStatusText) planStatusText.textContent = status;
            });
            await renderChildStep();
          } catch (err) {
            showAlert(err.message || 'Subscription failed');
          } finally {
            btnSelect.disabled = false;
            btnSelect.textContent = `Select ${p.name}`;
            if (planStatusText) planStatusText.textContent = '';
          }
        });

        container.appendChild(card);
      });
    }

    /**
     * Renders plan comparison cards marking the active plan.
     */
    function renderComparisonCards(container, activePlanCode) {
      const plans = window.ParentOnboardingShell.state.plans || [];
      container.innerHTML = '';

      plans.forEach((p) => {
        const isCurrent = p.code === activePlanCode;
        const card = document.createElement('div');
        card.className = `pos-plan-card ${isCurrent ? 'featured' : ''}`;
        const priceRupees = Math.round(p.amountPaise / 100);
        const maxChildren = p.entitlements?.max_children ?? 1;

        card.innerHTML = `
          ${isCurrent ? '<span class="pos-badge" style="background:#86efac; color:#042f1a;">CURRENT PLAN</span>' : '<span class="pos-badge">UPGRADE OPTION</span>'}
          <h3>${p.name}</h3>
          <div class="pos-price">₹${priceRupees}<span>/month</span></div>
          <p class="pos-plan-desc">${p.description || ''}</p>
          <ul class="pos-features">
            <li><i class="fa-solid fa-check text-cyan"></i> Up to <strong>${maxChildren} learner${maxChildren > 1 ? 's' : ''}</strong></li>
            <li><i class="fa-solid fa-check text-cyan"></i> <strong>${p.entitlements?.monthly_ai_sessions || 100} AI sessions</strong> / month</li>
            <li><i class="fa-solid fa-check text-cyan"></i> <strong>${p.entitlements?.monthly_voice_minutes || 30} voice mins</strong> / month</li>
            <li><i class="fa-solid fa-check text-cyan"></i> Multilingual explanations</li>
          </ul>
          ${
            isCurrent
              ? `<button class="pos-plan-btn" disabled style="opacity: 0.7; background: #86efac; color: #042f1a;">Active Plan</button>`
              : `<button class="pos-secondary-btn pos-btn-upgrade-notice" type="button">Upgrade (Coming Soon)</button>`
          }
        `;

        const btnUpgrade = card.querySelector('.pos-btn-upgrade-notice');
        if (btnUpgrade) {
          btnUpgrade.addEventListener('click', () => {
            showAlert('Seamless in-app plan upgrades will be available in the next release. Contact support if you need immediate capacity expansion.', 'success');
          });
        }

        container.appendChild(card);
      });
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
            <strong>${vm.planName} (${vm.displayPrice}/mo)</strong>
          </div>
          <span>Learners: <strong>${vm.childCount} / ${vm.maxChildren}</strong></span>
        `;
        childListContainer.appendChild(summaryBar);

        if (vm.children.length > 0) {
          const listTitle = document.createElement('h4');
          listTitle.className = 'pos-subtitle';
          listTitle.textContent = 'Select Learner Profile:';
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
          // Quota reached: hide child form and show informative upgrade prompt
          if (childNewFormWrap) childNewFormWrap.style.display = 'none';

          const quotaNotice = document.createElement('div');
          quotaNotice.className = 'pos-quota-box';
          quotaNotice.innerHTML = `
            <i class="fa-solid fa-circle-info text-cyan"></i>
            <div>
              <strong>Learner limit reached (${vm.childCount} of ${vm.maxChildren} used)</strong>
              <p>Your current ${vm.planName} Plan supports up to ${vm.maxChildren} learner${vm.maxChildren > 1 ? 's' : ''}.</p>
              <button id="pos-btn-view-upgrade-from-quota" class="pos-link-btn" type="button">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> View / Upgrade Plans
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
  }

  return { init };
});
