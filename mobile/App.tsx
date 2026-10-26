import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";

const API = (
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");
type User = {
  id: string;
  name: string;
  email: string;
  role: "student" | "owner";
  canteen_id: string;
};
type Canteen = { id: string; name: string; organization: string };
type Menu = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  active: number | boolean;
  vegetarian: number | boolean;
  allergens: string;
};
type Slot = {
  id: string;
  starts: string;
  ends: string;
  capacity: number;
  remaining: number;
};
type Order = {
  id: string;
  token: string;
  pickup_code: string;
  status: string;
  payment_mode: string;
  payment_status: string;
  total: number;
  cancel_requested: number;
  cancel_reason: string;
  items: { menu_id: string; name: string; price: number; quantity: number }[];
  slot: Slot;
};
const money = (n: number) => `₹${(n / 100).toFixed(n % 100 ? 2 : 0)}`;
const slotLabel = (s: Slot) =>
  new Date(s.starts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }) + " IST";
const storage = {
  get: () =>
    Platform.OS === "web"
      ? Promise.resolve(sessionStorage.getItem("cantea_session"))
      : SecureStore.getItemAsync("cantea_session"),
  set: (s: string) =>
    Platform.OS === "web"
      ? Promise.resolve(sessionStorage.setItem("cantea_session", s))
      : SecureStore.setItemAsync("cantea_session", s),
  remove: () =>
    Platform.OS === "web"
      ? Promise.resolve(sessionStorage.removeItem("cantea_session"))
      : SecureStore.deleteItemAsync("cantea_session"),
};
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: "#174C3C" }]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Field({
  value,
  onChangeText,
  placeholder,
  secure = false,
  numeric = false,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder: string;
  secure?: boolean;
  numeric?: boolean;
}) {
  return (
    <TextInput
      accessibilityLabel={placeholder}
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#7A847E"
      secureTextEntry={secure}
      autoCapitalize="none"
      keyboardType={numeric ? "numeric" : "default"}
    />
  );
}
function confirm(title: string, message: string, fn: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(title + "\n" + message)) fn();
  } else
    Alert.alert(title, message, [
      { text: "Keep it", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: fn },
    ]);
}

export default function App() {
  const [token, setToken] = useState(""),
    [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [canteens, setCanteens] = useState<Canteen[]>([]),
    [canteen, setCanteen] = useState(""),
    [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [tab, setTab] = useState("Menu"),
    [menu, setMenu] = useState<Menu[]>([]),
    [slots, setSlots] = useState<Slot[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [slot, setSlot] = useState(""),
    [cart, setCart] = useState<Record<string, number>>({}),
    [mode, setMode] = useState<"cash" | "online">("cash"),
    [category, setCategory] = useState("All"),
    [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null),
    [codes, setCodes] = useState<Record<string, string>>({}),
    [reasons, setReasons] = useState<Record<string, string>>({}),
    [refs, setRefs] = useState<Record<string, string>>({});
  const [editMenu, setEditMenu] = useState<Menu | null>(null),
    [mName, setMName] = useState(""),
    [mCategory, setMCategory] = useState("Breakfast"),
    [mPrice, setMPrice] = useState(""),
    [mStock, setMStock] = useState(""),
    [mAllergens, setMAllergens] = useState(""),
    [mVeg, setMVeg] = useState(true),
    [mActive, setMActive] = useState(true);
  const [slotStart, setSlotStart] = useState(""),
    [slotEnd, setSlotEnd] = useState(""),
    [capacity, setCapacity] = useState("20");
  const idempotency = useRef(""),
    active = useRef(true),
    mutating = useRef(false);
  async function api(
    path: string,
    options: RequestInit = {},
    authToken = token,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(API + path, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: "Bearer " + authToken } : {}),
          ...options.headers,
        },
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail || "Request failed"),
        );
      return data;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError")
        throw new Error("Request timed out. Refresh orders before retrying.");
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function refresh(authToken = token) {
    if (!authToken) return;
    const [m, s, o] = await Promise.all([
      api("/menu", {}, authToken),
      api("/slots", {}, authToken),
      api("/orders", {}, authToken),
    ]);
    if (active.current) {
      setMenu(m);
      setSlots(s);
      setOrders(o);
    }
  }
  async function run(fn: () => Promise<void>) {
    if (mutating.current) return;
    mutating.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }
  async function signOut() {
    await storage.remove();
    setToken("");
    setUser(null);
    setCart({});
    setOrders([]);
    setMenu([]);
    setTab("Menu");
    setEditing(null);
  }
  useEffect(() => {
    active.current = true;
    (async () => {
      try {
        const list = await api("/canteens", {}, "");
        setCanteens(list);
        setCanteen(list[0]?.id || "");
        const saved = await storage.get();
        if (saved) {
          try {
            const u = await api("/me", {}, saved);
            setToken(saved);
            setUser(u);
            setTab(u.role === "owner" ? "Kitchen" : "Menu");
            await refresh(saved);
          } catch {
            await storage.remove();
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Cannot connect");
      } finally {
        setBoot(false);
      }
    })();
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      if (AppState.currentState === "active") refresh().catch(() => {});
    }, 10000);
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh().catch(() => {});
    });
    return () => {
      clearInterval(interval);
      listener.remove();
    };
  }, [token]);
  async function submitAuth() {
    await run(async () => {
      const result = await api(
        register ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(
            register
              ? { name, email, password, canteen_id: canteen }
              : { email, password },
          ),
        },
        "",
      );
      await storage.set(result.token);
      setToken(result.token);
      setUser(result.user);
      setPassword("");
      setTab(result.user.role === "owner" ? "Kitchen" : "Menu");
      await refresh(result.token);
    });
  }
  function changeQty(id: string, d: number) {
    setCart((c) => ({
      ...c,
      [id]: Math.max(0, Math.min(20, (c[id] || 0) + d)),
    }));
    idempotency.current = "";
  }
  const entries = Object.entries(cart).filter(([, q]) => q > 0),
    total = entries.reduce(
      (sum, [id, q]) => sum + (menu.find((m) => m.id === id)?.price || 0) * q,
      0,
    );
  async function place() {
    await run(async () => {
      if (!entries.length) throw new Error("Add a meal first");
      const items = entries.map(([menu_id, quantity]) => ({
        menu_id,
        quantity,
      }));
      if (editing) {
        await api(`/orders/${editing}/items`, {
          method: "PUT",
          body: JSON.stringify({ items }),
        });
        setEditing(null);
      } else {
        if (!slot) throw new Error("Choose a pickup slot");
        if (!idempotency.current)
          idempotency.current =
            Date.now() + "-" + Math.random().toString(36).slice(2);
        await api("/orders", {
          method: "POST",
          headers: { "Idempotency-Key": idempotency.current },
          body: JSON.stringify({ items, slot_id: slot, payment_mode: mode }),
        });
      }
      setCart({});
      idempotency.current = "";
      setTab("Orders");
      await refresh();
    });
  }
  function editCart(o: Order) {
    setCart(Object.fromEntries(o.items.map((i) => [i.menu_id, i.quantity])));
    setSlot(o.slot.id);
    setEditing(o.id);
    setTab("Menu");
    setError("");
  }
  async function action(path: string, body?: unknown) {
    await run(async () => {
      await api(path, {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      await refresh();
    });
  }
  function chooseMenu(m: Menu | null) {
    setEditMenu(m);
    setMName(m?.name || "");
    setMCategory(m?.category || "Breakfast");
    setMPrice(m ? String(m.price / 100) : "");
    setMStock(m ? String(m.stock) : "");
    setMAllergens(m?.allergens || "");
    setMVeg(m ? !!m.vegetarian : true);
    setMActive(m ? !!m.active : true);
  }
  async function saveMenu() {
    await run(async () => {
      const price = Math.round(Number(mPrice) * 100),
        stock = Number(mStock);
      if (
        !mPrice ||
        !mStock ||
        !Number.isFinite(price) ||
        !Number.isInteger(stock)
      )
        throw new Error("Enter a valid price and whole-number stock");
      await api(editMenu ? "/owner/menu/" + editMenu.id : "/owner/menu", {
        method: editMenu ? "PUT" : "POST",
        body: JSON.stringify({
          name: mName,
          category: mCategory,
          price,
          stock,
          allergens: mAllergens,
          vegetarian: mVeg,
          active: mActive,
        }),
      });
      chooseMenu(null);
      await refresh();
    });
  }
  const owner = user?.role === "owner";
  if (boot)
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator size="large" color="#174C3C" />
        <Text style={styles.muted}>Opening Cantea…</Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={() =>
              run(() =>
                user
                  ? refresh()
                  : api("/canteens", {}, "").then((c) => {
                      setCanteens(c);
                      setCanteen(c[0]?.id || "");
                    }),
              )
            }
          />
        }
      >
        <View style={styles.top}>
          <View>
            <Text style={styles.brand}>
              cantea<Text style={{ color: "#DF9651" }}>●</Text>
            </Text>
            <Text style={styles.eyebrow}>GOOD FOOD. LESS WAITING.</Text>
          </View>
          {user && (
            <Text style={styles.pill}>{owner ? "OWNER" : "CAMPUS"}</Text>
          )}
        </View>
        {!!error && (
          <View accessibilityRole="alert" style={styles.error}>
            <Text style={{ color: "#912F26" }}>{error}</Text>
            <Button title="Dismiss" secondary onPress={() => setError("")} />
          </View>
        )}
        {!user ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroSmall}>YOUR BREAK, RECLAIMED</Text>
              <Text style={styles.heroTitle}>
                {"Skip the queue.\nKeep the chai."}
              </Text>
              <Text style={styles.heroText}>
                Order ahead. Pick your time. Collect with a token.
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.title}>
                {register ? "Join your canteen" : "Welcome back"}
              </Text>
              {register && (
                <Field
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                />
              )}
              <Field
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
              />
              <Field
                value={password}
                onChangeText={setPassword}
                placeholder="Password (10+ characters)"
                secure
              />
              {register && (
                <>
                  <Text style={styles.label}>Choose your campus</Text>
                  {canteens.map((c) => (
                    <Button
                      key={c.id}
                      title={c.name + " · " + c.organization}
                      secondary={canteen !== c.id}
                      onPress={() => setCanteen(c.id)}
                    />
                  ))}
                </>
              )}
              <Button
                title={
                  busy
                    ? "Please wait…"
                    : register
                      ? "Create account"
                      : "Sign in"
                }
                disabled={busy || (!canteen && register)}
                onPress={submitAuth}
              />
              <Button
                title={
                  register
                    ? "Already registered? Sign in"
                    : "New here? Create account"
                }
                secondary
                onPress={() => setRegister(!register)}
              />
              <Text style={styles.muted}>
                Owners use the account provisioned by their canteen
                administrator.
              </Text>
            </View>
            <Button
              title="Privacy notice"
              secondary
              onPress={() => Linking.openURL(API + "/privacy")}
            />
          </>
        ) : (
          <>
            <View style={styles.nav}>
              {(owner
                ? ["Kitchen", "Inventory", "Slots", "Account"]
                : ["Menu", "Orders", "Account"]
              ).map((t) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t }}
                  key={t}
                  onPress={() => setTab(t)}
                  style={[styles.navItem, tab === t && styles.navActive]}
                >
                  <Text
                    style={[styles.navText, tab === t && { color: "#fff" }]}
                  >
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
            {tab === "Menu" && (
              <>
                <View style={styles.hero}>
                  <Text style={styles.heroSmall}>
                    HELLO, {user.name.split(" ")[0].toUpperCase()}
                  </Text>
                  <Text style={styles.heroTitle}>
                    {"A better break\nstarts here."}
                  </Text>
                  <Text style={styles.heroText}>
                    Fresh meals. Scheduled pickup. More time for you.
                  </Text>
                </View>
                <Field
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Find your next favourite…"
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 16 }}
                >
                  {["All", ...new Set(menu.map((m) => m.category))].map((c) => (
                    <Pressable
                      key={c}
                      style={[
                        styles.chip,
                        category === c && { backgroundColor: "#174C3C" },
                      ]}
                      onPress={() => setCategory(c)}
                    >
                      <Text
                        style={{
                          color: category === c ? "white" : "#174C3C",
                          fontWeight: "600",
                        }}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {menu
                  .filter(
                    (m) =>
                      (category === "All" || m.category === category) &&
                      m.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((m) => (
                    <View style={styles.card} key={m.id}>
                      <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.eyebrow}>
                            {m.vegetarian ? "● VEG" : "● NON-VEG"} ·{" "}
                            {m.category.toUpperCase()}
                          </Text>
                          <Text style={styles.title}>{m.name}</Text>
                          <Text style={styles.muted}>
                            {m.stock} available
                            {m.allergens ? " · Contains " + m.allergens : ""}
                          </Text>
                        </View>
                        <Text style={styles.price}>{money(m.price)}</Text>
                      </View>
                      <View style={styles.quantity}>
                        <Button
                          title="−"
                          secondary
                          onPress={() => changeQty(m.id, -1)}
                        />
                        <Text style={styles.title}>{cart[m.id] || 0}</Text>
                        <Button
                          title="+ Add"
                          disabled={
                            !m.active ||
                            (cart[m.id] || 0) >= m.stock ||
                            (cart[m.id] || 0) >= 20
                          }
                          onPress={() => changeQty(m.id, 1)}
                        />
                      </View>
                    </View>
                  ))}
                {!menu.length && (
                  <Text style={styles.muted}>
                    Your canteen has not published a menu yet.
                  </Text>
                )}
                <View style={styles.card}>
                  <Text style={styles.title}>
                    {editing ? "Update your order" : "Your break, booked"}
                  </Text>
                  <Text style={styles.price}>{money(total)}</Text>
                  {entries.map(([id, q]) => (
                    <Text key={id} style={styles.muted}>
                      {q} ×{" "}
                      {menu.find((m) => m.id === id)?.name ||
                        "Unavailable item"}
                    </Text>
                  ))}
                  {!editing && (
                    <>
                      <Text style={styles.label}>Pickup time</Text>
                      <ScrollView horizontal>
                        {slots
                          .filter((s) => s.remaining > 0)
                          .map((s) => (
                            <Pressable
                              key={s.id}
                              onPress={() => {
                                setSlot(s.id);
                                idempotency.current = "";
                              }}
                              style={[
                                styles.slot,
                                slot === s.id && {
                                  borderColor: "#174C3C",
                                  borderWidth: 2,
                                },
                              ]}
                            >
                              <Text style={styles.label}>{slotLabel(s)}</Text>
                              <Text style={styles.muted}>
                                {s.remaining} spots left
                              </Text>
                            </Pressable>
                          ))}
                      </ScrollView>
                      {!slots.length && (
                        <Text style={styles.muted}>
                          No upcoming slots. The owner must open a pickup
                          window.
                        </Text>
                      )}
                      <View style={styles.row}>
                        <Button
                          title="Pay at counter"
                          secondary={mode !== "cash"}
                          onPress={() => {
                            setMode("cash");
                            idempotency.current = "";
                          }}
                        />
                        <Button
                          title="Pay online"
                          secondary={mode !== "online"}
                          onPress={() => {
                            setMode("online");
                            idempotency.current = "";
                          }}
                        />
                      </View>
                    </>
                  )}
                  <Button
                    title={editing ? "Save meal changes" : "Generate my token"}
                    disabled={busy || !entries.length || (!editing && !slot)}
                    onPress={place}
                  />
                  <Text style={styles.muted}>
                    Online reservations expire after 10 minutes without
                    confirmed payment. Pay from your order card after booking.
                  </Text>
                  {editing && (
                    <Button
                      title="Stop editing"
                      secondary
                      onPress={() => {
                        setEditing(null);
                        setCart({});
                      }}
                    />
                  )}
                </View>
              </>
            )}
            {(tab === "Orders" || tab === "Kitchen") && (
              <>
                <Text style={styles.title}>
                  {owner ? "Kitchen queue" : "Your tokens"}
                </Text>
                <Text style={styles.muted}>
                  {owner
                    ? "Resolve cancellation requests before starting preparation."
                    : "Updates refresh every 10 seconds. Pull down to refresh now."}
                </Text>
                {!orders.length && (
                  <View style={styles.card}>
                    <Text style={styles.title}>
                      Your first token is waiting.
                    </Text>
                    <Text style={styles.muted}>
                      Orders appear here after checkout.
                    </Text>
                  </View>
                )}
                {orders.map((o) => (
                  <View style={styles.card} key={o.id}>
                    <View style={styles.row}>
                      <Text style={styles.token}>{o.token}</Text>
                      <Text style={styles.pill}>{o.status.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.label}>{slotLabel(o.slot)}</Text>
                    {o.items.map((i) => (
                      <Text key={i.menu_id} style={styles.muted}>
                        {i.quantity} × {i.name}
                      </Text>
                    ))}
                    <Text style={styles.price}>
                      {money(o.total)}{" "}
                      <Text style={styles.muted}>
                        · {o.payment_status.replace("_", " ")} ·{" "}
                        {o.payment_mode}
                      </Text>
                    </Text>
                    {!owner && o.status !== "cancelled" && (
                      <View style={styles.code}>
                        <Text style={styles.eyebrow}>SHOW AT COLLECTION</Text>
                        <Text style={styles.token}>{o.pickup_code}</Text>
                      </View>
                    )}
                    {!!o.cancel_requested && (
                      <Text style={styles.warning}>
                        Cancellation requested: {o.cancel_reason}
                      </Text>
                    )}
                    {o.status === "cancelled" && (
                      <Text style={styles.muted}>{o.cancel_reason}</Text>
                    )}
                    {!owner && o.status === "placed" && (
                      <>
                        {o.payment_status === "due" && !o.cancel_requested && (
                          <>
                            <Button
                              title="Pay securely online"
                              disabled={busy}
                              onPress={() =>
                                run(async () => {
                                  const c = await api(
                                    "/orders/" + o.id + "/checkout",
                                    { method: "POST" },
                                  );
                                  await Linking.openURL(c.url);
                                  await refresh();
                                })
                              }
                            />
                            <Button
                              title="Change meals"
                              secondary
                              disabled={busy}
                              onPress={() => editCart(o)}
                            />
                          </>
                        )}
                        {!o.cancel_requested && (
                          <>
                            <Field
                              value={reasons[o.id] || ""}
                              onChangeText={(s) =>
                                setReasons({ ...reasons, [o.id]: s })
                              }
                              placeholder="Cancellation reason"
                            />
                            <Button
                              title="Request cancellation"
                              secondary
                              disabled={busy}
                              onPress={() =>
                                action("/orders/" + o.id + "/cancel-request", {
                                  reason: reasons[o.id] || "Plans changed",
                                })
                              }
                            />
                          </>
                        )}
                      </>
                    )}
                    {owner && (
                      <>
                        {o.cancel_requested ? (
                          <View style={styles.row}>
                            <Button
                              title="Approve cancellation"
                              disabled={busy}
                              onPress={() =>
                                action(
                                  "/owner/orders/" + o.id + "/cancel-decision",
                                  { approve: true },
                                )
                              }
                            />
                            <Button
                              title="Reject"
                              secondary
                              disabled={busy}
                              onPress={() =>
                                action(
                                  "/owner/orders/" + o.id + "/cancel-decision",
                                  { approve: false },
                                )
                              }
                            />
                          </View>
                        ) : null}
                        {o.payment_status === "due" &&
                          ["placed", "preparing", "ready"].includes(
                            o.status,
                          ) && (
                            <Button
                              title="Record cash received"
                              secondary
                              disabled={busy}
                              onPress={() =>
                                confirm(
                                  "Confirm payment",
                                  `You received ${money(o.total)} in cash for ${o.token}.`,
                                  () =>
                                    action("/owner/orders/" + o.id + "/cash"),
                                )
                              }
                            />
                          )}
                        {["placed", "preparing", "ready"].includes(o.status) &&
                          !o.cancel_requested && (
                            <>
                              {o.status === "ready" && (
                                <Field
                                  value={codes[o.id] || ""}
                                  onChangeText={(s) =>
                                    setCodes({ ...codes, [o.id]: s })
                                  }
                                  placeholder="Customer collection code"
                                />
                              )}
                              <Button
                                title={
                                  o.status === "placed"
                                    ? "Start preparing"
                                    : o.status === "preparing"
                                      ? "Mark ready"
                                      : "Confirm collection"
                                }
                                disabled={busy}
                                onPress={() =>
                                  action("/owner/orders/" + o.id + "/status", {
                                    status:
                                      o.status === "placed"
                                        ? "preparing"
                                        : o.status === "preparing"
                                          ? "ready"
                                          : "collected",
                                    pickup_code: codes[o.id] || "",
                                  })
                                }
                              />
                            </>
                          )}
                        {o.payment_status === "refund_due" && (
                          <>
                            <Text style={styles.warning}>
                              Return cash or process the full refund in Razorpay
                              first.
                            </Text>
                            <Field
                              value={refs[o.id] || ""}
                              onChangeText={(s) =>
                                setRefs({ ...refs, [o.id]: s })
                              }
                              placeholder="Refund ID / cash receipt reference"
                            />
                            <Button
                              title="Verify and record refund"
                              disabled={busy}
                              onPress={() =>
                                action(
                                  "/owner/orders/" + o.id + "/refund-confirm",
                                  { reference: refs[o.id] || "" },
                                )
                              }
                            />
                          </>
                        )}
                      </>
                    )}
                  </View>
                ))}
              </>
            )}
            {tab === "Inventory" && (
              <>
                <Text style={styles.title}>Menu & stock</Text>
                <Text style={styles.muted}>
                  Stock means unreserved portions available to sell. Existing
                  orders keep their original prices.
                </Text>
                {menu.map((m) => (
                  <Pressable
                    key={m.id}
                    style={styles.card}
                    onPress={() => chooseMenu(m)}
                  >
                    <View style={styles.row}>
                      <Text style={styles.title}>{m.name}</Text>
                      <Text style={styles.price}>{money(m.price)}</Text>
                    </View>
                    <Text style={styles.muted}>
                      {m.stock} portions · {m.active ? "Available" : "Hidden"} ·
                      Tap to edit
                    </Text>
                  </Pressable>
                ))}
                <View style={styles.card}>
                  <Text style={styles.title}>
                    {editMenu ? "Edit " + editMenu.name : "Add a meal"}
                  </Text>
                  <Field
                    value={mName}
                    onChangeText={setMName}
                    placeholder="Meal name"
                  />
                  <Field
                    value={mCategory}
                    onChangeText={setMCategory}
                    placeholder="Category"
                  />
                  <Field
                    value={mPrice}
                    onChangeText={setMPrice}
                    placeholder="Price in rupees"
                    numeric
                  />
                  <Field
                    value={mStock}
                    onChangeText={setMStock}
                    placeholder="Available portions"
                    numeric
                  />
                  <Field
                    value={mAllergens}
                    onChangeText={setMAllergens}
                    placeholder="Allergens, e.g. milk, peanuts"
                  />
                  <Button
                    title={mVeg ? "Vegetarian ✓" : "Non-vegetarian"}
                    secondary
                    onPress={() => setMVeg(!mVeg)}
                  />
                  <Button
                    title={
                      mActive ? "Available for ordering ✓" : "Hidden from menu"
                    }
                    secondary
                    onPress={() => setMActive(!mActive)}
                  />
                  <Button
                    title="Save meal"
                    disabled={busy}
                    onPress={saveMenu}
                  />
                  {editMenu && (
                    <Button
                      title="Add a different meal"
                      secondary
                      onPress={() => chooseMenu(null)}
                    />
                  )}
                </View>
              </>
            )}
            {tab === "Slots" && (
              <>
                <Text style={styles.title}>Pickup windows</Text>
                <Text style={styles.muted}>
                  Publish slots only during canteen hours. Capacity is the
                  number of orders accepted in each window.
                </Text>
                <View style={styles.card}>
                  <Field
                    value={slotStart}
                    onChangeText={setSlotStart}
                    placeholder="Start: 2026-10-24T12:00:00+05:30"
                  />
                  <Field
                    value={slotEnd}
                    onChangeText={setSlotEnd}
                    placeholder="End: 2026-10-24T12:15:00+05:30"
                  />
                  <Field
                    value={capacity}
                    onChangeText={setCapacity}
                    placeholder="Order capacity"
                    numeric
                  />
                  <Button
                    title="Open pickup slot"
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        await api("/owner/slots", {
                          method: "POST",
                          body: JSON.stringify({
                            starts: slotStart,
                            ends: slotEnd,
                            capacity: Number(capacity),
                          }),
                        });
                        setSlotStart("");
                        setSlotEnd("");
                        await refresh();
                      })
                    }
                  />
                </View>
                {slots.map((s) => (
                  <View style={styles.card} key={s.id}>
                    <Text style={styles.label}>{slotLabel(s)}</Text>
                    <Text style={styles.muted}>
                      {s.remaining} / {s.capacity} spaces available
                    </Text>
                  </View>
                ))}
              </>
            )}
            {tab === "Account" && (
              <View style={styles.card}>
                <Text style={styles.title}>{user.name}</Text>
                <Text style={styles.muted}>{user.email}</Text>
                <Text style={styles.label}>
                  {canteens.find((c) => c.id === user.canteen_id)?.name}
                </Text>
                <Text style={styles.muted}>
                  Cantea pilot 0.1.0 · Collection at the counter. No delivery
                  service.
                </Text>
                <Button
                  title="Privacy notice"
                  secondary
                  onPress={() => Linking.openURL(API + "/privacy")}
                />
                <Button
                  title="Sign out"
                  onPress={() =>
                    run(async () => {
                      try {
                        await api("/auth/logout", { method: "POST" });
                      } finally {
                        await signOut();
                      }
                    })
                  }
                />
                <Button
                  title="Delete account"
                  secondary
                  disabled={busy}
                  onPress={() =>
                    confirm(
                      "Delete your account?",
                      "Profile details and sessions will be removed. Anonymized transaction records remain. Settle orders and refunds first.",
                      () =>
                        run(async () => {
                          await api("/me", { method: "DELETE" });
                          await signOut();
                        }),
                    )
                  }
                />
              </View>
            )}
          </>
        )}
        <Text style={styles.footer}>cantea · Make time for your break.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F6F5EE",
    paddingTop: Platform.OS === "android" ? 28 : 0,
  },
  container: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 20,
    paddingBottom: 50,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  brand: {
    fontSize: 38,
    fontWeight: "900",
    color: "#174C3C",
    letterSpacing: -2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#527265",
    marginVertical: 6,
  },
  pill: {
    backgroundColor: "#E9EDDF",
    color: "#345847",
    padding: 8,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
  },
  hero: {
    backgroundColor: "#174C3C",
    padding: 26,
    borderRadius: 24,
    marginBottom: 22,
  },
  heroSmall: {
    color: "#C6D8AA",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
  },
  heroTitle: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "800",
    color: "#FFFDF3",
    marginTop: 16,
    marginBottom: 16,
    letterSpacing: -1,
  },
  heroText: { color: "#D3DED4", fontSize: 15, lineHeight: 23 },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E6E8DF",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#243C31",
    marginVertical: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#355344",
    marginVertical: 8,
  },
  muted: { fontSize: 13, color: "#68776E", lineHeight: 21 },
  input: {
    backgroundColor: "#F7F8F4",
    borderWidth: 1,
    borderColor: "#DDE3D8",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#243C31",
    marginVertical: 6,
  },
  button: {
    backgroundColor: "#174C3C",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  secondary: { backgroundColor: "#EDF0E6" },
  buttonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  nav: {
    flexDirection: "row",
    backgroundColor: "#E8ECDF",
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  navItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 11,
    alignItems: "center",
  },
  navActive: { backgroundColor: "#174C3C" },
  navText: { fontSize: 12, fontWeight: "700", color: "#527265" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  quantity: {
    flexDirection: "row",
    gap: 20,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  price: {
    fontSize: 20,
    fontWeight: "800",
    color: "#174C3C",
    marginVertical: 8,
  },
  chip: {
    padding: 12,
    paddingHorizontal: 20,
    backgroundColor: "#E8ECDF",
    borderRadius: 24,
    marginRight: 8,
  },
  slot: {
    borderWidth: 1,
    borderColor: "#DDE3D8",
    padding: 12,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: "#F8F9F4",
  },
  token: {
    fontSize: 21,
    fontWeight: "800",
    color: "#174C3C",
    letterSpacing: 1,
  },
  code: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5C5",
    paddingTop: 14,
    marginTop: 14,
  },
  warning: {
    fontSize: 13,
    color: "#98551B",
    backgroundColor: "#FFF1D8",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  error: {
    backgroundColor: "#FDE7E1",
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#7A8B7D",
    marginTop: 26,
  },
});
