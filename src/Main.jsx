import { DynamicWidget, useIsLoggedIn, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useState, useEffect } from "react";
import DynamicMethods from "./Methods.js";
import "./Main.css";
import {
  createSmartAccountClient,
  walletClientToSmartAccountSigner,
} from "permissionless";
import { toEcdsaKernelSmartAccount } from "permissionless/accounts";
import { http } from "viem";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { polygonAmoy, baseSepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { parseEther } from "viem";
import { isEthereumWallet } from "@dynamic-labs/ethereum";

const checkIsDarkSchemePreferred = () =>
  window?.matchMedia?.("(prefers-color-scheme:dark)")?.matches ?? false;

const networkMap = {
  [baseSepolia.id]: baseSepolia,
  [polygonAmoy.id]: polygonAmoy,
};

const Main = () => {
  const isLoggedIn = useIsLoggedIn();
  const { primaryWallet } = useDynamicContext();
  const [isDarkMode, setIsDarkMode] = useState(checkIsDarkSchemePreferred);
  const [selectedNetwork, setSelectedNetwork] = useState(polygonAmoy); // Default network
  const [publicClient, setPublicClient] = useState(null);
  const [smartAccountClient, setSmartAccountClient] = useState(null);
  const [kernelAccount, setKernelAccount] = useState(null);
  const [disableSendTransaction, setDisableSendTransaction] = useState(true);
  const [disableInitializeClients, setDisableInitializeClients] = useState(false);
  const API_KEY = process.env.REACT_APP_PIMLICO_API_KEY;

  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setIsDarkMode(checkIsDarkSchemePreferred());
    darkModeMediaQuery.addEventListener("change", handleChange);
    return () => darkModeMediaQuery.removeEventListener("change", handleChange);
  }, []);

  const initializeClients = async () => {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
      console.error("No valid wallet found!");
      return;
    }
    try {
      console.log("Initializing clients...");

      setDisableInitializeClients(true); // Disable button during initialization

      // Initialize the public client
      const publicC = await primaryWallet.getPublicClient();
      const walletClient = await primaryWallet.getWalletClient();
      setPublicClient(publicC);

      // Initialize Pimlico client
      const pimlicoUrl = `https://api.pimlico.io/v2/${selectedNetwork.id}/rpc?apikey=${API_KEY}`;
      const pimlicoClient = createPimlicoClient({
        chain: selectedNetwork.id,
        transport: http(pimlicoUrl),
        entryPoint: {
          address: entryPoint07Address,
          version: "0.7", // Kernel version
        },
      });

      const kernelSmartAccount = await toEcdsaKernelSmartAccount({
        owners: [walletClient],
        client: publicC,
        entryPoint: {
          address: entryPoint07Address,
          version: "0.7",
        },
      });

      console.log("Kernel smart account:", kernelSmartAccount);

      // Initialize the smart account client
      const smartClient = createSmartAccountClient({
        account: kernelSmartAccount,
        chain: selectedNetwork,
        bundlerTransport: http(pimlicoUrl),
        paymasterContext: {
          sponsorshipPolicyId: "sp_dry_dreaming_celestial",
        },
        userOperation: {
          estimateFeesPerGas: async () =>
            (await pimlicoClient.getUserOperationGasPrice()).fast, // Using Pimlico bundlers
        },
      });

      console.log("Smart account client initialized:", smartClient);

      setSmartAccountClient(smartClient);
      setKernelAccount(kernelSmartAccount);
      setDisableSendTransaction(false); // Enable the transaction button
    } catch (error) {
      console.error("Error initializing clients:", error);
      alert("Failed to initialize clients. Please try again.");
      setDisableInitializeClients(false); // Re-enable if initialization fails
    } 
  };
  const handleSendTransaction = async () => {
    if (!smartAccountClient || !kernelAccount) {
      console.error("SmartAccountClient or KernelAccount is not initialized!");
      return;
    }

    try {
      const transaction = {
        to: "0xcC90c7c3E3Ad6e4E6bd8CF4fB10D09edC20a9506", // Replace with recipient address
        value: parseEther("0.0001"), // 0.0001 ETH
        data: "0x", // No calldata
      };

      console.log("Sending transaction:", transaction);

      // Send transaction
      const txHash = await smartAccountClient.sendTransaction(transaction);
      console.log("Transaction sent! Hash:", txHash);

      // Wait for transaction receipt (optional)
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log("Transaction receipt:", receipt);
      alert(`Transaction sent successfully! Hash: ${txHash}`);
    } catch (error) {
      console.error("Error sending transaction:", error);
      alert("Failed to send transaction. Please try again.");
    } 
    finally {
      setDisableInitializeClients(false); // Re-enable button after initialization
  };
  };

  return (
    <div className={`container ${isDarkMode ? "dark" : "light"}`}>
      <div className="header">
        <img
          className="logo"
          src={isDarkMode ? "/logo-light.png" : "/logo-dark.png"}
          alt="dynamic"
        />
        <div className="header-buttons">
          <button
            className="docs-button"
            onClick={() => window.open("https://docs.dynamic.xyz", "_blank", "noopener,noreferrer")}
          >
            Docs
          </button>
          <button
            className="get-started"
            onClick={() => window.open("https://app.dynamic.xyz", "_blank", "noopener,noreferrer")}
          >
            Get started
          </button>
        </div>
      </div>
      <div className="modal">
        <DynamicWidget />
        <DynamicMethods isDarkMode={isDarkMode} />
        <div className="network-selection">
          <label htmlFor="network-select">Choose Network:</label>
          <select
            id="network-select"
            onChange={(e) =>
              setSelectedNetwork(networkMap[Number(e.target.value)])
            }
            defaultValue={polygonAmoy.id}
          >
            <option value={baseSepolia.id}>Base Sepolia</option>
            <option value={polygonAmoy.id}>Polygon Amoy</option>
          </select>
        </div>
        <button
          className="btn btn-secondary"
          onClick={initializeClients}
          disabled={disableInitializeClients}
        >
          Initialize Clients
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSendTransaction}
          disabled={disableSendTransaction}
        >
          Send Sponsored Transaction
        </button>
      </div>
      <div className="footer">
        <div className="footer-text">Made with ❤️ by dynamic</div>
        <img
          className="footer-image"
          src={isDarkMode ? "/image-dark.png" : "/image-light.png"}
          alt="dynamic"
        />
      </div>
    </div>
  );
};

export default Main;
