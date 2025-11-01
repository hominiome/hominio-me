<script>
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";

  // Session data from layout
  let { data } = $props();

  let signingOut = $state(false);
  let imageFailed = $state(false);

  async function handleSignOut() {
    signingOut = true;
    await authClient.signOut();
    goto("/alpha");
  }
</script>

<div class="profile-container">
  <div class="profile-card">
    <div class="profile-header">
      <div class="avatar">
        {#if data.session?.image && !imageFailed}
          <img 
            src={data.session.image} 
            alt={data.session.name}
            onerror={() => (imageFailed = true)}
          />
        {:else}
          <div class="avatar-placeholder">
            {data.session?.name?.charAt(0).toUpperCase() || "U"}
          </div>
        {/if}
      </div>
      <h1 class="profile-name">{data.session?.name || "User"}</h1>
      <p class="profile-email">{data.session?.email}</p>
    </div>

    <div class="profile-section">
      <h2 class="section-title">Alpha Access</h2>
      <div class="alpha-badge">
        <span class="badge-icon">✓</span>
        <div class="badge-content">
          <p class="badge-title">Active Alpha Member</p>
          <p class="badge-text">
            You're part of the Hominio Alpha. We'll keep you updated on the
            journey to 1 million co-owners.
          </p>
        </div>
      </div>
    </div>

    <div class="profile-section">
      <h2 class="section-title">Account Details</h2>
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">Name</span>
          <span class="detail-value">{data.session?.name || "—"}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Email</span>
          <span class="detail-value">{data.session?.email || "—"}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">ID</span>
          <span class="detail-value detail-mono">{data.session?.id || "—"}</span>
        </div>
      </div>
    </div>

    <div class="profile-actions">
      <button onclick={() => goto("/alpha")} class="btn btn-secondary">
        Back to Alpha
      </button>
      <button
        onclick={handleSignOut}
        disabled={signingOut}
        class="btn btn-outline"
      >
        {signingOut ? "Signing out..." : "Sign Out"}
      </button>
    </div>
  </div>
</div>

<style>
  .profile-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: linear-gradient(135deg, #f0fffe 0%, #fff9e6 100%);
  }

  .profile-card {
    width: 100%;
    max-width: 600px;
    background: white;
    border-radius: 24px;
    box-shadow:
      0 8px 32px rgba(79, 195, 195, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.05);
    padding: 3rem;
    border: 2px solid #4fc3c3;
  }

  .profile-header {
    text-align: center;
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 2px solid #e5e7eb;
  }

  .avatar {
    width: 120px;
    height: 120px;
    margin: 0 auto 1.5rem;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid #4fc3c3;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #4fc3c3 0%, #3da8a8 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    font-weight: 900;
    color: white;
  }

  .profile-name {
    font-size: 2rem;
    font-weight: 800;
    color: #111827;
    margin: 0 0 0.5rem 0;
    letter-spacing: -0.02em;
  }

  .profile-email {
    font-size: 1.125rem;
    color: #6b7280;
    margin: 0;
  }

  .profile-section {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 1rem 0;
  }

  .alpha-badge {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #f0fffe 0%, white 100%);
    border-radius: 12px;
    border: 2px solid #4fc3c3;
  }

  .badge-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    background: #4fc3c3;
    color: white;
    font-size: 1.5rem;
    font-weight: 900;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .badge-content {
    flex: 1;
  }

  .badge-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .badge-text {
    font-size: 0.938rem;
    line-height: 1.5;
    color: #6b7280;
    margin: 0;
  }

  .details-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
  }

  .detail-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-value {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }

  .detail-mono {
    font-family: monospace;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .profile-actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px solid #e5e7eb;
  }

  .btn {
    flex: 1;
    padding: 0.875rem 1.5rem;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #4fc3c3;
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #3da8a8;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(79, 195, 195, 0.3);
  }

  .btn-outline {
    background: white;
    color: #6b7280;
    border: 2px solid #e5e7eb;
  }

  .btn-outline:hover:not(:disabled) {
    border-color: #dc2626;
    color: #dc2626;
  }

  @media (max-width: 640px) {
    .profile-container {
      padding: 1rem;
    }

    .profile-card {
      padding: 2rem 1.5rem;
    }

    .avatar {
      width: 100px;
      height: 100px;
    }

    .profile-name {
      font-size: 1.625rem;
    }

    .profile-actions {
      flex-direction: column;
    }
  }
</style>

