import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import RecipeCard from "../components/RecipeCard";
import RecipeToolbar, { applyRecipeFilters, SortKey } from "../components/RecipeToolbar";
import { colors } from "../theme";
import { searchUsers, sendInvite, getInvites, acceptInvite, declineInvite, listFriends, getFriendRecipes, FriendSearchResult, Invite } from "../api/friends";
import type { RecipeListItem } from "../api/recipes";

type FriendRecipe = RecipeListItem & { ownerId: number; ownerName: string };

const ALL_ID = -1;

export default function FriendsPage() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendSearchResult[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [recipes, setRecipes] = useState<FriendRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [recipeSort, setRecipeSort] = useState<SortKey>("newest");

  useEffect(() => {
    Promise.all([listFriends(), getInvites()])
      .then(([f, i]) => { setFriends(f); setInvites(i); })
      .finally(() => setLoading(false));
  }, []);

  async function handleUserSearch(q: string) {
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

  async function handleSelectFriend(friendId: number) {
    setSelectedFriendId(friendId);
    setRecipeQuery("");
    setLoadingRecipes(true);
    try {
      if (friendId === ALL_ID) {
        const results = await Promise.all(
          friends.map(f =>
            getFriendRecipes(f.id)
              .then(rs => rs.map(r => ({ ...r, ownerId: f.id, ownerName: f.display_name })))
              .catch(() => [] as FriendRecipe[])
          )
        );
        setRecipes(results.flat());
      } else {
        const friend = friends.find(f => f.id === friendId);
        if (!friend) { setRecipes([]); return; }
        const rs = await getFriendRecipes(friendId);
        setRecipes(rs.map(r => ({ ...r, ownerId: friend.id, ownerName: friend.display_name })));
      }
    } catch {
      setRecipes([]);
    } finally {
      setLoadingRecipes(false);
    }
  }

  function handleOpenFriendRecipe(ownerId: number, recipeId: number) {
    navigate(`/friends/${ownerId}/recipes/${recipeId}`);
  }

  const visibleRecipes = useMemo(
    () => applyRecipeFilters(recipes, recipeQuery, recipeSort),
    [recipes, recipeQuery, recipeSort],
  );

  const selectedLabel =
    selectedFriendId === ALL_ID ? "All friends" :
    friends.find(f => f.id === selectedFriendId)?.display_name ?? "";

  function pillStyle(active: boolean): React.CSSProperties {
    return {
      padding: "8px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer",
      border: active ? "none" : `1px solid ${colors.border}`,
      background: active ? colors.green : colors.white,
      color: active ? colors.white : colors.text,
      fontWeight: active ? 600 : 400,
      fontFamily: "system-ui, sans-serif",
    };
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", flexDirection: "column" }}>
      <Header />
      <div style={{ maxWidth: 1000, width: "100%", margin: "0 auto", padding: "clamp(16px, 4vw, 32px)", flex: 1, fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: "clamp(18px, 3.5vw, 24px)", marginBottom: 24 }}>Friends</h2>

        {/* Find-a-friend search */}
        <div style={{ marginBottom: 24 }}>
          <input
            value={searchQuery}
            onChange={e => handleUserSearch(e.target.value)}
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

            {/* Friends pills */}
            <h3 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 16, marginBottom: 12 }}>Your friends</h3>
            {friends.length === 0 ? (
              <p style={{ color: colors.muted, fontSize: 14 }}>No friends yet — search above to find people to cook with.</p>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                <button
                  onClick={() => handleSelectFriend(ALL_ID)}
                  style={pillStyle(selectedFriendId === ALL_ID)}
                >
                  All friends
                </button>
                {friends.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleSelectFriend(f.id)}
                    style={pillStyle(selectedFriendId === f.id)}
                  >
                    {f.display_name}
                  </button>
                ))}
              </div>
            )}

            {/* Recipes grid */}
            {selectedFriendId !== null && (
              <div>
                <h3 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 16, marginBottom: 12 }}>
                  {selectedFriendId === ALL_ID ? "All friends' recipes" : `${selectedLabel}'s recipes`}
                </h3>

                {loadingRecipes ? (
                  <LoadingSpinner label="Loading recipes..." />
                ) : recipes.length === 0 ? (
                  <p style={{ color: colors.muted, fontSize: 14 }}>No recipes to show yet.</p>
                ) : (
                  <>
                    <RecipeToolbar
                      query={recipeQuery}
                      onQueryChange={setRecipeQuery}
                      sort={recipeSort}
                      onSortChange={setRecipeSort}
                      placeholder={selectedFriendId === ALL_ID ? "Search all friends' recipes..." : `Search ${selectedLabel}'s recipes...`}
                    />
                    {visibleRecipes.length === 0 ? (
                      <p style={{ color: colors.muted, fontSize: 14, textAlign: "center", padding: "32px 0" }}>
                        No recipes match "{recipeQuery}".
                      </p>
                    ) : (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                        gap: 16,
                      }}>
                        {visibleRecipes.map(r => (
                          <RecipeCard
                            key={`${r.ownerId}-${r.id}`}
                            recipe={r}
                            ownerName={selectedFriendId === ALL_ID ? r.ownerName : undefined}
                            onClick={() => handleOpenFriendRecipe(r.ownerId, r.id)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
