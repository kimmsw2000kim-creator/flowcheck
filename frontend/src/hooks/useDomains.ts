import { useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { useDomainStore } from '../store/domainStore';
import { supabase } from "../lib/supabaseClient";

export function useDomains() {
  const currentUserEmail = useUserStore((state) => state.currentUser.email);
  const loadDomains = useDomainStore((state) => state.loadDomains);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && currentUserEmail) {
        loadDomains();
      }
    });
  }, [currentUserEmail, loadDomains]);

  const domains = useDomainStore((state) => state.domains);
  const newDomainUrl = useDomainStore((state) => state.newDomainUrl);
  const setNewDomainUrl = useDomainStore((state) => state.setNewDomainUrl);
  const verificationLoading = useDomainStore((state) => state.verificationLoading);
  const handleAddDomain = useDomainStore((state) => state.handleAddDomain);
  const handleVerifyDomain = useDomainStore((state) => state.handleVerifyDomain);
  const handleDeleteDomain = useDomainStore((state) => state.handleDeleteDomain);

  return {
    domains,
    newDomainUrl,
    setNewDomainUrl,
    verificationLoading,
    handleAddDomain,
    handleVerifyDomain,
    handleDeleteDomain,
  };
}
