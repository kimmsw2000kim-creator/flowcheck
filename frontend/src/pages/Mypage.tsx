import { CreditCard, Globe, Ticket, Activity } from 'lucide-react';

import { useState } from 'react';
import type { MypageData } from '../types/mypage';

import MypageStatCard from '../components/MypageStatCard';
import MypageSidebar from '../components/MypageSidebar';
import flowCheckLogo from '../assets/flowcheck.png';
import MypageSiteList from "../components/MypageSiteList.tsx";

interface SiteSummary {
    siteId: number;
    serviceName: string;
    domainURL: string;
    isVerified: boolean;
    createdAt: string;
}


const mockData: MypageData = {
    email: 'user@flowcheck.com',
    balance: 1200,
    couponCount: 3,
    registeredSiteCount: 2,
    testRunCount: 12,
    sites: [
        {
            siteId: 1,
            serviceName: 'myshop',
            domainUrl: 'https://myshop.com',
            isVerified: true,
            createdAt: '2026-07-01T10:00:00',
        },
        {
            siteId: 2,
            serviceName: 'blogexample',
            domainUrl: 'https://blogexample.com',
            isVerified: false,
            createdAt: '2026-07-01T11:00:00',
        },
    ],
};

function Mypage() {
    const [data] = useState<MypageData>(mockData);

    return (
        <div className="mypage-layout">
            <MypageSidebar />

            <main className="mypage-main">
                <section className="mypage-header">
                    <div>
                        <h1>마이페이지</h1>
                        <p>{data.email}</p>
                    </div>
                </section>

                <section className="mypage-stats">
                    <MypageStatCard
                        icon={CreditCard}
                        label="포인트"
                        value={`${data.balance.toLocaleString()}P`}
                    />

                    <MypageStatCard
                        icon={Ticket}
                        label="이용권"
                        value={`${data.couponCount}회`}
                    />

                    <MypageStatCard
                        icon={Globe}
                        label="인증 사이트"
                        value={`${data.registeredSiteCount}개`}
                    />

                    <MypageStatCard
                        icon={Activity}
                        label="총 테스트"
                        value={`${data.testRunCount}회`}
                    />
                </section>

                <MypageSiteList sites={data.sites} />
            </main>


        </div>
    );
}

export default Mypage;