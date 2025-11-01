<script lang="ts">
  let { data } = $props<{ data: { user: { id: string; name: string | null; image: string | null } } }>();
</script>

<div class="container">
  {#if data.user}
    <div class="profile-card">
      <div class="profile-header">
        {#if data.user.image}
          <img src={data.user.image} alt={data.user.name || "User"} class="profile-avatar" />
        {:else}
          <div class="profile-avatar-placeholder">
            {data.user.name?.[0]?.toUpperCase() || "?"}
          </div>
        {/if}
        <h1 class="profile-name">{data.user.name || "Anonymous"}</h1>
      </div>

      <div class="profile-info">
        <p class="info-text">
          This is a public profile. Email and other private information is not
          displayed.
        </p>
      </div>

      <div class="profile-actions">
        <a href="/alpha/projects" class="btn-secondary">View All Projects</a>
        <a href="/alpha" class="btn-primary">Back to Home</a>
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 4rem 1rem;
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }


  .profile-card {
    background: white;
    padding: 3rem;
    border-radius: 24px;
    border: 2px solid rgba(78, 205, 196, 0.2);
    text-align: center;
    width: 100%;
    box-shadow: 0 4px 20px rgba(78, 205, 196, 0.1);
  }

  .profile-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .profile-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 4px solid #4ecdc4;
    object-fit: cover;
  }

  .profile-avatar-placeholder {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 4px solid #4ecdc4;
    background: linear-gradient(135deg, #4ecdc4, #f4d03f);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 900;
    font-size: 3rem;
    text-transform: uppercase;
  }

  .profile-name {
    color: #1a1a4e;
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
  }

  .profile-info {
    margin: 2rem 0;
    padding: 1.5rem;
    background: rgba(78, 205, 196, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(78, 205, 196, 0.2);
  }

  .info-text {
    color: #1a1a4e;
    font-size: 0.875rem;
    margin: 0;
    line-height: 1.6;
  }

  .profile-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 2rem;
  }

  .btn-primary,
  .btn-secondary {
    display: inline-block;
    padding: 0.875rem 2rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none;
    transition: all 0.2s;
    cursor: pointer;
    border: none;
  }

  .btn-primary {
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(78, 205, 196, 0.3);
  }

  .btn-secondary {
    background: white;
    color: #1a1a4e;
    border: 2px solid rgba(26, 26, 78, 0.2);
  }

  .btn-secondary:hover {
    background: rgba(26, 26, 78, 0.05);
    border-color: rgba(26, 26, 78, 0.3);
  }

  @media (max-width: 768px) {
    .profile-actions {
      flex-direction: column;
    }

    .btn-primary,
    .btn-secondary {
      width: 100%;
      text-align: center;
    }
  }
</style>

