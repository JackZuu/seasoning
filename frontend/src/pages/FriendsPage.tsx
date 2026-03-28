import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import { colors } from "../theme";
import { searchUsers, sendInvite, getInvites, acceptInvite, declineInvite, listFriends, getFriendRecipes, copyRecipe, FriendSearchResult, Invite } from "../api/friends";
import type { RecipeListItem } from "../api/recipes";

export default function FriendsPage() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendSearchResult[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendSearchResult | null>(null);
  const [friendRecipes, setFriendRecipes] = useState<RecipeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  useEffect(() => {
    Promise.all([listFriends(), getInvites()])
      .then(([f, i]) => { setFriends(f); setInvites(i); })
      .finally(() => setLoading(false));
  }, []);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const results = await searchUsers(q);
    setSearchResults(results.filter(r => !friends.some(f => f.id === r.id)));
  }

  async function handleInvite(userId: number) {
    try {
      await sendInvite(userId);
      setSearchResults(prev => prev.filter(r => r.id !== userId));
      alert("Invite sent!");
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleAccept(inviteId: number, fromUser: FriendSearchResult) {
    try {
      await acceptInvite(inviteId);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      setFriends(prev => [...prev, fromUser]);
    } catch (e: any) {
      alert("Failed to accept: " + e.message);
    }
  }

  async function handleDecline(inviteId: number) {
    try {
      await declineInvite(inviteId);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (e: any) {
      alert("Failed to decline: " + e.message);
    }
  }

  async function handleSelectFriend(friend: FriendSearchResult) {
    setSelectedFriend(friend);
    setLoadingRecipes(true);
    try {
      const recipes = await getFriendRecipes(friend.id);
      setFriendRecipes(recipes);
    } catch { setFriendRecipes([]); }
    finally { setLoadingRecipes(false); }
  }

  async function handleCopyRecipe(recipeId: number) {
    try {
      const recipe = await copyRecipe(recipeId);
      navigate(`/recipes/${recipe.id}`);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", flexDirection: "column" }}>
      <Header />
      <div style={{ maxWidth: 800, width: "100%", margin: "0 auto", padding: "clamp(16px, 4vw, 32px)", flex: 1, fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: "clamp(18px, 3.5vw, 24px)", marginBottom: 24 }}>Friends</h2>

        {/* Search */}
        <div style={{ marginBottom: 24 }}>
          <input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search for friends by name..."
            style={{
              width: "100%", padding: "12px 16px", border: `1px solid ${colors.border}`,
              borderRadius: 10, fontSize: 14, outline: "none", color: colors.text,
              boxSizing: "border-box", fontFamily: "system-ui, sans-serif",
            }}
          />
          {searchResults.length > 0 && (
            <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 10, marginTop: 8 }}>
              {searchResults.map(u => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${colors.border}` }}>
                  <span style={{ fontSize: 14, color: colors.text }}>{u.display_name}</span>
                  <button onClick={() => handleInvite(u.id)} style={{
                    background: colors.green, color: colors.white, border: "none",
                    borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>+ Add</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? <LoadingSpinner label="Loading..." /> : (
          <>
            {/* Invites */}
            {invites.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 16, marginBottom: 12 }}>Invites</h3>
                {invites.map(inv => (
                  <div key={inv.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 10,
                    padding: "12px 16px", marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 14, color: colors.text }}>
                      <strong>{inv.from_user.display_name}</strong> wants to share recipes with you
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleAccept(inv.id, inv.from_user)} style={{
                        background: colors.green, color: colors.white, border: "none",
                        borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}>Accept</button>
                      <button onClick={() => handleDecline(inv.id)} style={{
                        background: "none", border: `1px solid ${colors.border}`,
                        borderRadius: 6, padding: "6px 14px", fontSize: 13, color: colors.muted, cursor: "pointer",
                      }}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Friends list */}
            <h3 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 16, marginBottom: 12 }}>Your friends</h3>
            {friends.length === 0 ? (
              <p style={{ color: colors.muted, fontSize: 14 }}>No friends yet — search above to find people to cook with.</p>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                {friends.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleSelectFriend(f)}
                    style={{
                      padding: "8px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                      border: selectedFriend?.id === f.id ? "none" : `1px solid ${colors.border}`,
                      background: selectedFriend?.id === f.id ? colors.green : colors.white,
                      color: selectedFriend?.id === f.id ? colors.white : colors.text,
                      fontWeight: selectedFriend?.id === f.id ? 600 : 400,
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    {f.display_name}
                  </button>
                ))}
              </div>
            )}

            {/* Friend's recipes */}
            {selectedFriend && (
              <div>
                <h3 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 16, marginBottom: 12 }}>
                  {selectedFriend.display_name}'s recipes
                </h3>
                {loadingRecipes ? <LoadingSpinner label="Loading recipes..." /> : (
                  friendRecipes.length === 0 ? (
                    <p style={{ color: colors.muted, fontSize: 14 }}>No recipes to show yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {friendRecipes.map(r => (
                        <div key={r.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 10,
                          padding: "12px 16px",
                        }}>
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>{r.title}</span>
                            <span style={{ fontSize: 12, color: colors.muted, marginLeft: 12 }}>{r.ingredient_count} ingredients</span>
                          </div>
                          <button onClick={() => handleCopyRecipe(r.id)} style={{
                            background: colors.green, color: colors.white, border: "none",
                            borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}>+ Save to mine</button>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
