import { useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { useDomainStore } from '../store/domainStore';

export function useDomains() {
  const currentUserEmail = useUserStore((state) => state.currentUser.email);
  const loadDomains = useDomainStore((state) => state.loadDomains);

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken && currentUserEmail) {
      loadDomains();
    }
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
