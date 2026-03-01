"use client";

import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth, db } from "@/lib/firebase";

const ADMIN_EMAILS = ["ahamdshah023@gmail.com"];

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  teamId?: string;
  teamName?: string;
};

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

type Props = {
  children: ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const appUser = await upsertUserProfile(firebaseUser);
      setUser(appUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

async function upsertUserProfile(firebaseUser: FirebaseUser): Promise<AppUser> {
  const email = firebaseUser.email ?? "";
  const isAdmin = ADMIN_EMAILS.includes(email);

  const userRef = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(userRef);

  let data: DocumentData | undefined;

  if (!snap.exists()) {
    data = {
      uid: firebaseUser.uid,
      email,
      displayName: firebaseUser.displayName ?? "",
      isAdmin,
      createdAt: new Date().toISOString(),
    };
    await setDoc(userRef, data, { merge: true });
  } else {
    data = snap.data();
    if (data.isAdmin !== isAdmin) {
      await setDoc(
        userRef,
        {
          isAdmin,
        },
        { merge: true },
      );
    }
  }

  return {
    uid: firebaseUser.uid,
    email: email || null,
    displayName: firebaseUser.displayName ?? null,
    isAdmin,
    teamId: data?.teamId,
    teamName: data?.teamName,
  };
}

export function useAuth() {
  return useContext(AuthContext);
}

