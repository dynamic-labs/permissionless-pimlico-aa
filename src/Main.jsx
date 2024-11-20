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
import { polygonAmoy, baseSepolia, optimismSepolia, sepolia, } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { parseEther } from "viem";
import { isEthereumWallet } from "@dynamic-labs/ethereum";


const checkIsDarkSchemePreferred = () =>
  window?.matchMedia?.("(prefers-color-scheme:dark)")?.matches ?? false;

const networkMap = {
  [baseSepolia.id]: baseSepolia,
  //[polygonAmoy.id]: polygonAmoy,
  // [optimismSepolia.id]: optimismSepolia,
  [sepolia.id]: sepolia,
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
  const [ sendingTransaction, setSendingTransaction ] = useState(false);
  const [ toAddress, setToAddress ] = useState("");

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
          sponsorshipPolicyId: "sp_cynical_speed",
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
      setSendingTransaction(true); // Show the spinner
  
      const transaction = {
        to: toAddress, // Replace with recipient address
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
    } finally {
      setSendingTransaction(false); 
      setDisableInitializeClients(false); // Re-enable the initialize button
    }
  };

  return (
    <div className={`container ${isDarkMode ? "dark" : "light"}`}>
      <header className="header">
        <img
          className="logo"
          src={isDarkMode ? "/logo-light.png" : "/logo-dark.png"}
          alt="Dynamic Logo"
        />
        <div className="header-buttons">
          <button
            className="btn docs-button"
            onClick={() => window.open("https://docs.dynamic.xyz", "_blank", "noopener,noreferrer")}
          >
            Docs
          </button>
          <button
            className="btn get-started"
            onClick={() => window.open("https://app.dynamic.xyz", "_blank", "noopener,noreferrer")}
          >
            Get Started
          </button>
        </div>
      </header>
  
      {/* Main Content Section */}
      <main className="modal">
        <DynamicWidget />
        <DynamicMethods isDarkMode={isDarkMode} />
  
        {isLoggedIn ? (
          <div className="user-actions">
            <div className="network-selection">
              <label htmlFor="network-select" className="network-label"><b>Choose Network:  </b></label>
              <select
                id="network-select"
                className="network-dropdown"
                onChange={(e) => setSelectedNetwork(networkMap[Number(e.target.value)])}
                defaultValue={polygonAmoy.id}
              >
                <option value={baseSepolia.id}>Base Sepolia</option>
                {/* <option value={polygonAmoy.id}>Polygon Amoy</option>
                <option value={optimismSepolia.id}>Optimism Sepolia</option> */}
                <option value={sepolia.id}>Sepolia</option>
              </select>
            </div>
            <br/>
            <label htmlFor="enter-address" className="network-label"><b>Enter To Address:  </b> </label>

            <input
              id="toAddress"
              className="user-actions"
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="Enter To Address"
            />
            <br/>
            <br/>

            <label htmlFor="enter-address" className="network-label"><b>Click to Initialize clients  </b> </label>
            <div className="action-buttons">
              <button
                className="btn btn-primary"
                onClick={initializeClients}
                disabled={disableInitializeClients}
              >
                Initialize Clients
              </button>
              <br/>

              {sendingTransaction ? (
                <div className="spinner">
                  <span>sending transaction...</span>
                </div>
              ) : (
                <>
                <label htmlFor="enter-address" className="network-label"><b>Click to Send Transaction:  </b> </label>
                <br/>
                <button
                  className="btn btn-primary"
                  onClick={handleSendTransaction}
                  disabled={disableSendTransaction}
                >
                  Send Sponsored Transaction
                </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="login-prompt">Please log in to get started.</p>
        )}
      </main>
  
      {/* Footer Section */}
      <footer className="footer">
        <p className="footer-text">Made with ❤️ by Dynamic</p>
        <img
          className="footer-image"
          src={isDarkMode ? "/image-dark.png" : "/image-light.png"}
          alt="Dynamic Footer"
        />
      </footer>
    </div>
  );

}
  

export default Main;
