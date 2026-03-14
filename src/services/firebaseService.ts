import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import bcrypt from 'bcryptjs';

// Types
export interface Church {
  id?: string;
  name: string;
  password?: string;
  createdAt: any;
}

export interface Member {
  id?: string;
  name: string;
  phone: string;
  address: string;
  birthDate: string;
  registrationDate: string;
}

export interface Offering {
  id?: string;
  memberId: string;
  type: string;
  amount: number;
  date: string;
  notes: string;
  memberName?: string;
}

export interface Transaction {
  id?: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  memberId?: string;
  memberName?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// Church Operations
export const getAllChurches = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'churches'));
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        name: data.name,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      } as Church;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'churches');
    return [];
  }
};

export const getChurchByName = async (name: string) => {
  try {
    const q = query(collection(db, 'churches'), where('name', '==', name));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data();
    return { 
      id: snapshot.docs[0].id, 
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
    } as Church;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `churches/name:${name}`);
    return null;
  }
};

export const addChurch = async (name: string, passwordRaw: string) => {
  try {
    const passwordHash = await bcrypt.hash(passwordRaw, 10);
    const docRef = await addDoc(collection(db, 'churches'), {
      name,
      password: passwordHash,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'churches');
  }
};

export const updateChurch = async (churchId: string, data: { name?: string; password?: string }) => {
  try {
    const docRef = doc(db, 'churches', churchId);
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    await updateDoc(docRef, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `churches/${churchId}`);
  }
};

export const deleteChurch = async (churchId: string) => {
  try {
    await deleteDoc(doc(db, 'churches', churchId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `churches/${churchId}`);
  }
};

export const loginChurch = async (name: string, passwordRaw: string) => {
  try {
    const q = query(collection(db, 'churches'), where('name', '==', name));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const churchDoc = snapshot.docs[0];
    const churchData = churchDoc.data();
    
    const isMatch = await bcrypt.compare(passwordRaw, churchData.password);
    if (!isMatch) return null;
    
    return {
      id: churchDoc.id,
      name: churchData.name,
      createdAt: churchData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
    } as Church;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `churches/login:${name}`);
    return null;
  }
};

// Member Operations
export const getMembers = async (churchId: string) => {
  try {
    const snapshot = await getDocs(query(collection(db, `churches/${churchId}/members`), orderBy('name', 'asc')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `churches/${churchId}/members`);
    return [];
  }
};

export const addMember = async (churchId: string, member: Omit<Member, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, `churches/${churchId}/members`), {
      ...member,
      registrationDate: member.registrationDate || new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `churches/${churchId}/members`);
  }
};

export const updateMember = async (churchId: string, memberId: string, member: Partial<Member>) => {
  try {
    const docRef = doc(db, `churches/${churchId}/members`, memberId);
    await updateDoc(docRef, member);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `churches/${churchId}/members/${memberId}`);
  }
};

export const deleteMember = async (churchId: string, memberId: string) => {
  try {
    await deleteDoc(doc(db, `churches/${churchId}/members`, memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `churches/${churchId}/members/${memberId}`);
  }
};

// Offering Operations
export const getOfferings = async (churchId: string) => {
  try {
    const snapshot = await getDocs(query(collection(db, `churches/${churchId}/offerings`), orderBy('date', 'desc')));
    const offerings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offering));
    
    // Fetch member names
    const members = await getMembers(churchId);
    const memberMap = new Map(members.map(m => [m.id, m.name]));
    
    return offerings.map(o => ({
      ...o,
      memberName: memberMap.get(o.memberId) || 'Unknown'
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `churches/${churchId}/offerings`);
    return [];
  }
};

export const addOffering = async (churchId: string, offering: Omit<Offering, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, `churches/${churchId}/offerings`), {
      ...offering,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `churches/${churchId}/offerings`);
  }
};

export const updateOffering = async (churchId: string, offeringId: string, offering: Partial<Offering>) => {
  try {
    const docRef = doc(db, `churches/${churchId}/offerings`, offeringId);
    await updateDoc(docRef, offering);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `churches/${churchId}/offerings/${offeringId}`);
  }
};

export const deleteOffering = async (churchId: string, offeringId: string) => {
  try {
    await deleteDoc(doc(db, `churches/${churchId}/offerings`, offeringId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `churches/${churchId}/offerings/${offeringId}`);
  }
};

// Transaction Operations
export const getTransactions = async (churchId: string) => {
  try {
    const snapshot = await getDocs(query(collection(db, `churches/${churchId}/transactions`), orderBy('date', 'desc')));
    const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    
    // Fetch member names for transactions that have them
    const members = await getMembers(churchId);
    const memberMap = new Map(members.map(m => [m.id, m.name]));
    
    return transactions.map(t => ({
      ...t,
      memberName: t.memberId ? memberMap.get(t.memberId) : undefined
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `churches/${churchId}/transactions`);
    return [];
  }
};

export const addTransaction = async (churchId: string, transaction: Omit<Transaction, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, `churches/${churchId}/transactions`), {
      ...transaction,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `churches/${churchId}/transactions`);
  }
};

export const updateTransaction = async (churchId: string, transactionId: string, transaction: Partial<Transaction>) => {
  try {
    const docRef = doc(db, `churches/${churchId}/transactions`, transactionId);
    await updateDoc(docRef, transaction);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `churches/${churchId}/transactions/${transactionId}`);
  }
};

export const deleteTransaction = async (churchId: string, transactionId: string) => {
  try {
    await deleteDoc(doc(db, `churches/${churchId}/transactions`, transactionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `churches/${churchId}/transactions/${transactionId}`);
  }
};

// Stats
export const getStats = async (churchId: string) => {
  const offerings = await getOfferings(churchId);
  const transactions = await getTransactions(churchId);
  const members = await getMembers(churchId);

  const totalOfferings = offerings.reduce((sum, o) => sum + o.amount, 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  return {
    totalIncome: totalOfferings + totalIncome,
    totalExpense,
    memberCount: members.length
  };
};

// Reports
export const getSummaryReport = async (churchId: string, start: string, end: string) => {
  const offerings = await getOfferings(churchId);
  const transactions = await getTransactions(churchId);

  const filteredOfferings = offerings.filter(o => o.date >= start && o.date <= end);
  const filteredTransactions = transactions.filter(t => t.date >= start && t.date <= end);

  const offeringSummary = filteredOfferings.reduce((acc: any, o) => {
    acc[o.type] = (acc[o.type] || 0) + o.amount;
    return acc;
  }, {});

  const otherIncomeSummary = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((acc: any, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const expenseSummary = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  // Merge offerings into income summary
  const combinedIncomes = Object.entries(offeringSummary).map(([category, total]) => ({ category, total: total as number }));
  Object.entries(otherIncomeSummary).forEach(([category, total]) => {
    const existing = combinedIncomes.find(i => i.category === category);
    if (existing) {
      existing.total += total as number;
    } else {
      combinedIncomes.push({ category, total: total as number });
    }
  });

  const expenses = Object.entries(expenseSummary).map(([category, total]) => ({ category, total: total as number }));

  return { offerings: [], otherIncomes: combinedIncomes, expenses };
};

export const getDonationReceipt = async (churchId: string, memberId: string, year: string) => {
  const offerings = await getOfferings(churchId);
  const transactions = await getTransactions(churchId);
  const members = await getMembers(churchId);

  const member = members.find(m => m.id === memberId);
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const filteredOfferings = offerings.filter(o => o.memberId === memberId && o.date >= start && o.date <= end);
  const filteredTransactions = transactions.filter(t => t.memberId === memberId && t.type === 'income' && t.date >= start && t.date <= end);

  const mergedOfferings: any[] = [];

  filteredOfferings.forEach(o => {
    const existing = mergedOfferings.find(m => m.type === o.type);
    if (existing) {
      existing.total += o.amount;
    } else {
      mergedOfferings.push({ type: o.type, total: o.amount });
    }
  });

  filteredTransactions.forEach(t => {
    const existing = mergedOfferings.find(m => m.type === t.category);
    if (existing) {
      existing.total += t.amount;
    } else {
      mergedOfferings.push({ type: t.category, total: t.amount });
    }
  });

  return { member, offerings: mergedOfferings, year };
};

// Data Restore
export const restoreData = async (churchId: string, type: 'members' | 'offerings' | 'transactions', data: any[]) => {
  try {
    const collectionPath = `churches/${churchId}/${type}`;
    const promises = data.map(item => {
      // Remove ID to avoid conflicts and let Firestore generate new ones
      const { id, ...rest } = item;
      return addDoc(collection(db, collectionPath), rest);
    });
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `churches/${churchId}/${type}/restore`);
  }
};
