using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Threading.Tasks;
using Windows.Storage;
using Windows.Storage.Pickers;
using Windows.Storage.Streams;
using Windows.Web.Http;

namespace breaker
{
    public sealed class Chunk
    {
        public string name { get; set; }
        public string id { get; set; }
    }

    public sealed class Instance
    {
        private IList<string> _result = new List<string>();
        public IList<string> Result
        {
            get { return _result; }
        }

        public async void createChunks(IList<string> chunkNameList, IList<string> chunkIdList,
            IList<string> providerNameList, IList<string> providerTokenList, IList<string> cloudFolderList,
            IRandomAccessStream readStream, uint maxChunkSize)
        {
            try
            {
                // Convert lists to arrays
                string[] chunkNames = new string[chunkNameList.Count];
                chunkNameList.CopyTo(chunkNames, 0);
                string[] chunkIds = new string[chunkIdList.Count];
                chunkIdList.CopyTo(chunkIds, 0);
                string[] providerNames = new string[providerNameList.Count];
                providerNameList.CopyTo(providerNames, 0);
                string[] providerTokens = new string[providerTokenList.Count];
                providerTokenList.CopyTo(providerTokens, 0);
                string[] cloudFolders = new string[cloudFolderList.Count];
                cloudFolderList.CopyTo(cloudFolders, 0);
                // Number of bytes read from the readStream
                ulong nbread = 0;
                uint nbProviders = (uint)providerNames.Length;
                int chunkIdx = 0;
                using (IInputStream inputStream = readStream.GetInputStreamAt(0))
                {
                    using (var dataReader = new DataReader(inputStream))
                    {
                        while (nbread < readStream.Size)
                        {
                            DataWriter[] chunkWriters = new DataWriter[nbProviders];
                            for (int i = 0; i < nbProviders; i++)
                            {
                                chunkWriters[i] = new DataWriter();
                            }
                            uint nbloaded = await dataReader.LoadAsync(nbProviders * maxChunkSize);
                            byte[] temp = new byte[nbloaded];
                            // Fill buffers with data
                            dataReader.ReadBytes(temp);
                            for (int i = 0; i < nbloaded; i++)
                            {
                                if (i < nbProviders && providerNames[i % nbProviders] == "gdrive" && chunkIds[chunkIdx + i % nbProviders] == "none")
                                {
                                    // Starts the multipart data for new Google Drive chunks
                                    chunkWriters[i % nbProviders].WriteString("--trustydrive_separator\nContent-Type: application/json; charset=UTF-8\n\n"
                                        + "{\n\"name\": \"" + chunkNames[chunkIdx + i % nbProviders] + "\",\n\"parents\": [ \"" + cloudFolders[i % nbProviders]
                                        + "\" ]\n}\n\n--trustydrive_separator\nContent-Type: application/octet-stream\n\n");
                                    StorageFile log = await ApplicationData.Current.LocalFolder.CreateFileAsync("log.txt", CreationCollisionOption.ReplaceExisting);
                                    await FileIO.WriteTextAsync(log, "idata: " + i + "/" + nbloaded);
                                }
                                chunkWriters[i % nbProviders].WriteByte(temp[i]);
                                if (i + nbProviders >= nbloaded && providerNames[i % nbProviders] == "gdrive" && chunkIds[chunkIdx + i % nbProviders] == "none")
                                {
                                    // Ends with the multipart separator for new Google Drive chunks
                                    chunkWriters[i % nbProviders].WriteString("\n--trustydrive_separator--");
                                }
                            }
                            for (int i = 0; i < nbProviders; i++)
                            {
                                uploadAsync(providerNames[i], providerTokens[i], cloudFolders[i], chunkNames[chunkIdx], chunkIds[chunkIdx++], chunkWriters[i].DetachBuffer());
                                chunkWriters[i].Dispose();
                                if (chunkIdx > 0 && chunkIdx % 10 == 0)
                                {
                                    await Task.Delay(TimeSpan.FromSeconds(1));
                                }
                            }
                            nbread += nbloaded;
                        }
                    }
                }
                readStream.Dispose();
            }
            catch (Exception e)
            {
                StorageFile log = await ApplicationData.Current.LocalFolder.CreateFileAsync("log.txt", CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(log, "error from the encoding process: " + e);
            }
        }

        private async void uploadAsync(string providerName, string token, string cloudFolder, string chunkName, string chunkId, IBuffer data)
        {
            try
            {
                HttpClient client = new HttpClient();
                String uri = "toBeFilled";
                HttpRequestMessage message;
                HttpResponseMessage response;
                switch (providerName)
                {
                    case "dropbox":
                        uri = "https://content.dropboxapi.com/1/files_put/auto/trustydrive/" + chunkName;
                        message = new HttpRequestMessage(HttpMethod.Put, new Uri(uri));
                        message.Headers.Append("Authorization", "Bearer " + token);
                        message.Content = new HttpBufferContent(data);
                        break;
                    case "onedrive":
                        uri = "https://api.onedrive.com/v1.0/drive/items/" + cloudFolder + ":/" + chunkName + ":/content?select=id";
                        message = new HttpRequestMessage(HttpMethod.Put, new Uri(uri));
                        message.Headers.Append("Authorization", "Bearer " + token);
                        message.Content = new HttpBufferContent(data);
                        message.Content.Headers.Append("Content-Type", "application/octet-stream");
                        break;
                    case "gdrive":
                        if (chunkId == "none")
                        {

                            uri = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
                            message = new HttpRequestMessage(HttpMethod.Post, new Uri(uri));
                        }
                        else
                        {
                            uri = "https://www.googleapis.com/upload/drive/v3/files/" + chunkId + "?uploadType=media";
                            message = new HttpRequestMessage(HttpMethod.Patch, new Uri(uri));
                        }
                        message.Headers.Append("Authorization", "Bearer " + token);
                        message.Content = new HttpBufferContent(data);
                        message.Content.Headers.Append("Content-Type", "multipart/related; boundary=trustydrive_separator");
                        break;
                    default:
                        // Never used, just for the compilation
                        message = new HttpRequestMessage();
                        break;
                }
                response = await client.SendRequestAsync(message);
                response.EnsureSuccessStatusCode();
                DataContractJsonSerializer jsonSerializer = new DataContractJsonSerializer(typeof(Chunk));
                Chunk ch = (Chunk)jsonSerializer.ReadObject(WindowsRuntimeStreamExtensions.AsStreamForRead(await response.Content.ReadAsInputStreamAsync()));
                if (providerName == "dropbox")
                {
                    _result.Add(chunkName);
                }
                else
                {
                    _result.Add(ch.name + ":$$:" + ch.id);
                }
            }
            catch (Exception e)
            {
                StorageFile log = await ApplicationData.Current.LocalFolder.CreateFileAsync("log.txt", CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(log, "error from the upload process: " + e);
            }
        }
    }
}
